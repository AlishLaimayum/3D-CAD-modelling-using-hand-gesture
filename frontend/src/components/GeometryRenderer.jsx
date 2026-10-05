/**
 * GeometryRenderer.jsx - Render Completed CAD Objects & Direct High-Frequency Interaction
 * 
 * 1. Efficiently renders completed CAD objects (Freehand curves, Lines, Rectangles).
 * 2. Uses memoized BufferGeometries to eliminate garbage collection on static objects.
 * 3. Mounts CursorRenderer and ActiveDrawingRenderer for zero-rerender active drawing.
 */

import { useMemo, memo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useCadStore } from '../store/useCadStore';
import { CursorRenderer } from './CursorRenderer';
import { ActiveDrawingRenderer } from './ActiveDrawingRenderer';

import { GEOMETRY_KIND, ExtrusionEngine, Profile2D } from '../cad/geometry/index.js';
import { getFaceFromHit } from '../cad/geometry/FaceEnumerator.js';

/**
 * Individual CAD Object Mesh
 * Renders Category 3: 3D Solid Geometry (watertight B-Rep), Category 2: 3D Surface, or Category 1: 2D Sketch
 */
const CadObjectItem = memo(function CadObjectItem({ obj, isSelected, isHovered, onSelectSolidMesh }) {
    const baseColor = obj.color || 0x00e5ff;
    const color = isSelected ? '#ff6600' : (isHovered ? '#ffaa00' : baseColor);
    const height = Math.max(0, obj.extrudeHeight ?? ((obj.scaleZ !== undefined && obj.scaleZ > 0.05 && obj.scaleZ !== 1) ? obj.scaleZ : 0));

    // Construct CAD SolidMesh — always re-extrude when height changes.
    // Do NOT short-circuit on obj.solidMesh: internalUpdateObject mutates the same
    // object reference (setExtrusionHeight), so React's memo would see no change
    // and return stale geometry. height is in the dep array, so this invalidates correctly.
    const solidMesh = useMemo(() => {
        if (height <= 0.01) return null;
        const prof = obj.profile || new Profile2D({
            points: obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []),
            type: obj.type || 'FREEHAND',
            isClosed: obj.type === 'RECTANGLE' || obj.type === 'CIRCLE'
        });
        return ExtrusionEngine.extrude(prof, height);
    }, [obj.profile, obj.points, obj.start, obj.end, obj.type, height]);

    // Tessellated Three.js renderable mesh buffer
    const solidGeometry = useMemo(() => {
        if (!solidMesh) return null;
        return solidMesh.toThreeGeometry();
    }, [solidMesh]);

    // Crisp CAD feature edge wireframe
    const edgeGeometry = useMemo(() => {
        if (!solidMesh) return null;
        return solidMesh.toEdgeGeometry(25);
    }, [solidMesh]);

    // 2D Profile loop geometry (sketch outline at base)
    const baseGeometry = useMemo(() => {
        if (!obj) return null;

        if (obj.points && obj.points.length > 0) {
            const pts = obj.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
            // Close the loop for RECTANGLE and CIRCLE
            if ((obj.type === 'RECTANGLE' && pts.length >= 4) || (obj.type === 'CIRCLE' && pts.length >= 3)) {
                pts.push(new THREE.Vector3(pts[0].x, pts[0].y, pts[0].z));
            }
            return new THREE.BufferGeometry().setFromPoints(pts);
        } else if (obj.start && obj.end) {
            const pts = [
                new THREE.Vector3(obj.start[0], obj.start[1], obj.start[2]),
                new THREE.Vector3(obj.end[0], obj.end[1], obj.end[2])
            ];
            return new THREE.BufferGeometry().setFromPoints(pts);
        }
        return null;
    }, [obj]);

    // ---------------------------------------------------------
    // CATEGORY 3: TRUE 3D SOLID / B-REP MODEL (Height > 0)
    // ---------------------------------------------------------
    if (solidMesh && solidGeometry) {
        const val = solidMesh.validation || solidMesh.validateSolid();
        const bbox = solidMesh.boundingBox || { center: [0, height / 2, 0], max: [0, height, 0] };
        const dims = solidMesh.dimensions || { x: 0, y: height, z: 0 };

        return (
            <group>
                {/* Real 3D Solid Mesh with verified topology & outward normals */}
                <mesh
                    geometry={solidGeometry}
                    castShadow
                    receiveShadow
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelectSolidMesh?.(obj, e);
                    }}
                >
                    <meshStandardMaterial
                        color={color}
                        transparent
                        opacity={isSelected ? 0.78 : (isHovered ? 0.75 : 0.65)}
                        roughness={0.25}
                        metalness={0.2}
                        emissive={isSelected ? '#ff4400' : (isHovered ? '#ff9900' : '#000000')}
                        emissiveIntensity={isSelected ? 0.35 : (isHovered ? 0.28 : 0)}
                        side={THREE.DoubleSide}
                    />
                </mesh>

                {/* Crisp Glowing CAD Edge Lines for Feature & Boundary Edges */}
                {edgeGeometry && (
                    <lineSegments geometry={edgeGeometry}>
                        <lineBasicMaterial color={isSelected ? '#ffaa00' : (isHovered ? '#ffff00' : '#ffffff')} linewidth={2} />
                    </lineSegments>
                )}

                {/* Base 2D Sketch Outline on Plane */}
                {baseGeometry && (
                    <line geometry={baseGeometry}>
                        <lineBasicMaterial color={isSelected ? '#ff8800' : (isHovered ? '#ffcc00' : '#00e5ff')} linewidth={2} />
                    </line>
                )}

                {/* 3D Solid Dimensions & Volume HUD Badge */}
                <Text
                    position={[bbox.max[0] + 0.35, height / 2, bbox.center[2]]}
                    fontSize={0.26}
                    color="#00ffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    {`X:${dims.x.toFixed(1)} Y:${dims.y.toFixed(1)} Z:${dims.z.toFixed(1)} | V:${solidMesh.volume.toFixed(1)}`}
                </Text>

                {/* Watertight Solid Status Tag */}
                {isSelected && (
                    <Text
                        position={[bbox.center[0], height + 0.35, bbox.center[2]]}
                        fontSize={0.22}
                        color={val.isWatertight ? '#00ff66' : '#ffea00'}
                        anchorX="center"
                        anchorY="bottom"
                    >
                        {val.isWatertight ? '✓ 3D SOLID (WATERTIGHT)' : '3D SURFACE (OPEN)'}
                    </Text>
                )}
            </group>
        );
    }

    // ---------------------------------------------------------
    // CATEGORY 1: 2D FLAT PROFILE SKETCH (Default before Extrusion)
    // ---------------------------------------------------------
    if (baseGeometry) {
        return (
            <group>
                <line geometry={baseGeometry}>
                    <lineBasicMaterial color={color} linewidth={2} />
                </line>
            </group>
        );
    }

    return null;
});

/**
 * Invisible click-target mesh for selecting an object in SELECT mode.
 * Uses a bounding-box or thin plane covering the object's footprint.
 */
const SelectableHitMesh = memo(function SelectableHitMesh({ obj, onSelect }) {
    const hitGeom = useMemo(() => {
        if ((obj.type === 'RECTANGLE' || obj.type === 'CIRCLE') && obj.points && obj.points.length >= 3) {
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (const p of obj.points) {
                minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
                minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
            }
            const w = Math.max(0.1, maxX - minX);
            const d = Math.max(0.1, maxZ - minZ);
            const h = Math.max(0.05, obj.extrudeHeight || 0.05);
            return { type: 'box', w, h, d, cx: (minX + maxX) / 2, cy: h / 2, cz: (minZ + maxZ) / 2 };
        }
        // For lines/freehand: compute bounding box
        const pts = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
        if (pts.length < 2) return null;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const p of pts) {
            minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
            minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
        }
        const w = Math.max(0.3, maxX - minX + 0.3);
        const d = Math.max(0.3, maxZ - minZ + 0.3);
        const h = Math.max(0.05, obj.extrudeHeight || 0.05);
        return { type: 'box', w, h, d, cx: (minX + maxX) / 2, cy: h / 2, cz: (minZ + maxZ) / 2 };
    }, [obj]);

    if (!hitGeom) return null;

    return (
        <mesh
            position={[hitGeom.cx, hitGeom.cy, hitGeom.cz]}
            onClick={(e) => { e.stopPropagation(); onSelect(obj.id); }}
        >
            <boxGeometry args={[hitGeom.w, hitGeom.h, hitGeom.d]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
    );
});

export function CompletedObjectsRenderer() {
    const cadObjects = useCadStore((state) => state.cadObjects);
    const selectedObjectId = useCadStore((state) => state.selectedObjectId);
    const hoveredObjectId = useCadStore((state) => state.hoveredObjectId);
    const drawingMode = useCadStore((state) => state.drawingMode);
    const zHoldModeEnabled = useCadStore((state) => state.zHoldModeEnabled);
    const selectObject = useCadStore((state) => state.selectObject);
    const setSelectedFace = useCadStore((state) => state.setSelectedFace);

    const handleSelectSolidMesh = (obj, e) => {
        selectObject(obj.id);
        if (obj.extrudeHeight > 0.01 && e.face?.normal) {
            const face = getFaceFromHit(obj, e.face.normal, e.point);
            if (face) {
                setSelectedFace(face);
            }
        }
    };

    return (
        <group>
            {cadObjects.map((obj, idx) => {
                // Each object's points are plane-local. Apply the frozen creation-time
                // plane transform to convert them to world space.
                const pos = obj.planePosition || [0, 0, 0];
                const rot = obj.planeRotation || [Math.PI / 2, 0, 0];
                const isSelected = obj.id === selectedObjectId;
                const isHovered = obj.id === hoveredObjectId;
                return (
                    <group key={obj.id || `cad-obj-${idx}`} position={pos} rotation={rot}>
                        <CadObjectItem
                            obj={obj}
                            isSelected={isSelected}
                            isHovered={isHovered}
                            onSelectSolidMesh={handleSelectSolidMesh}
                        />
                        {(drawingMode === 'SELECT' || zHoldModeEnabled) && (
                            <SelectableHitMesh obj={obj} onSelect={selectObject} />
                        )}
                    </group>
                );
            })}
        </group>
    );
}

export function GeometryRenderer({ cursorPosRef, snapInfoRef, activeDrawingRef, drawingPointsRef }) {
    return (
        <group>
            {/* Active In-Progress Live Drawing (Zero-re-render Three.js Buffer) */}
            <ActiveDrawingRenderer 
                activeDrawingRef={activeDrawingRef} 
                drawingPointsRef={drawingPointsRef} 
                cursorPosRef={cursorPosRef}
            />

            {/* 3D Cursor & Magnetic Snap Target Indicator */}
            <CursorRenderer 
                cursorPosRef={cursorPosRef} 
                snapInfoRef={snapInfoRef} 
            />
        </group>
    );
}
