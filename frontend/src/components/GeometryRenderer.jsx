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

import { GEOMETRY_KIND, ExtrusionEngine, RevolveEngine, Profile2D } from '../cad/geometry/index.js';
import { getFaceFromHit } from '../cad/geometry/FaceEnumerator.js';

/**
 * Individual CAD Object Mesh
 * Renders Category 3: 3D Solid Geometry (watertight B-Rep), Category 2: 3D Surface, or Category 1: 2D Sketch
 */
const CadObjectItem = memo(function CadObjectItem({ obj, isSelected, isHovered, isFaceSelected, onSelectSolidMesh }) {
    const baseColor = obj.color || 0x00e5ff;
    // When a face is selected, the solid body remains in standard CAD style while FaceHighlightOverlay highlights only that face
    const isSolidSelected = isSelected && !isFaceSelected;
    const color = isSolidSelected ? '#00e5ff' : (isHovered ? '#00f0ff' : baseColor);
    const height = Math.max(0, obj.extrudeHeight ?? ((obj.scaleZ !== undefined && obj.scaleZ > 0.05 && obj.scaleZ !== 1) ? obj.scaleZ : 0));

    // Construct CAD SolidMesh for Extrusion or Revolve
    const solidMesh = useMemo(() => {
        if (obj.operation === 'REVOLVE' || obj.revolveData) {
            if (obj.solidMesh) return obj.solidMesh;
            const rData = obj.revolveData || {};
            const prof = obj.profile || new Profile2D({
                points: obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []),
                type: obj.type || 'FREEHAND',
                isClosed: !rData.isSurface
            });
            return RevolveEngine.revolve(
                prof,
                rData.axis || 'PROFILE_LEFT',
                rData.angleDeg ?? 360,
                rData.isSurface || false,
                rData.reversed || false
            );
        }
        if (height <= 0.01) return null;
        const prof = obj.profile || new Profile2D({
            points: obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []),
            type: obj.type || 'FREEHAND',
            isClosed: obj.type === 'RECTANGLE' || obj.type === 'CIRCLE'
        });
        return ExtrusionEngine.extrude(prof, height);
    }, [obj.solidMesh, obj.operation, obj.revolveData, obj.profile, obj.points, obj.start, obj.end, obj.type, height]);

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
                {/* Real 3D Solid Mesh: translucent with depthWrite=false so other geometry is never obscured */}
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
                        opacity={isSolidSelected ? 0.45 : (isHovered ? 0.55 : 0.65)}
                        roughness={0.2}
                        metalness={0.15}
                        emissive={isSolidSelected ? '#0088cc' : (isHovered ? '#005577' : '#000000')}
                        emissiveIntensity={isSolidSelected ? 0.25 : (isHovered ? 0.18 : 0)}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>

                {/* Crisp Glowing CAD Edge Lines for Feature & Boundary Edges */}
                {edgeGeometry && (
                    <lineSegments geometry={edgeGeometry}>
                        <lineBasicMaterial
                            color={isSolidSelected ? '#ffaa00' : (isHovered ? '#ffff00' : '#ffffff')}
                            linewidth={isSolidSelected ? 3 : 2}
                        />
                    </lineSegments>
                )}

                {/* Base 2D Sketch Outline on Plane */}
                {baseGeometry && (
                    <line geometry={baseGeometry}>
                        <lineBasicMaterial
                            color={isSolidSelected ? '#ffaa00' : (isHovered ? '#ffcc00' : '#00e5ff')}
                            linewidth={2}
                        />
                    </line>
                )}

                {/* 3D Solid Dimensions & Volume HUD Badge in Centimeters (cm) */}
                <Text
                    position={[bbox.max[0] + 0.35, obj.operation === 'REVOLVE' ? bbox.center[1] : height / 2, bbox.center[2]]}
                    fontSize={0.24}
                    color="#00ffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    {`X:${dims.x.toFixed(1)}cm Y:${dims.y.toFixed(1)}cm Z:${dims.z.toFixed(1)}cm | V:${solidMesh.volume.toFixed(1)}cm³`}
                </Text>

                {/* Operation Height / Revolve Angle */}
                <Text
                    position={[bbox.min[0] - 0.35, obj.operation === 'REVOLVE' ? bbox.center[1] : height / 2, bbox.center[2]]}
                    fontSize={0.22}
                    color="#00ff88"
                    anchorX="right"
                    anchorY="middle"
                >
                    {obj.operation === 'REVOLVE' ? `Rev: ${obj.revolveData?.angleDeg || 360}°` : `H: ${height.toFixed(2)} cm`}
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
        // Measurement text badge in centimeters for selected or hovered 2D sketch
        let dimText = null;
        let dimPos = [0, 0.25, 0];

        if (isSelected || isHovered) {
            if (obj.type === 'LINE' && (obj.points || (obj.start && obj.end))) {
                const pts = obj.points || [obj.start, obj.end];
                if (pts.length >= 2) {
                    const s = pts[0];
                    const e = pts[pts.length - 1];
                    const len = Math.hypot(e[0] - s[0], e[1] - s[1], e[2] - s[2]);
                    dimText = `L: ${len.toFixed(2)} cm`;
                    dimPos = [(s[0] + e[0]) / 2, ((s[1] + e[1]) / 2) + 0.25, (s[2] + e[2]) / 2];
                }
            } else if (obj.type === 'RECTANGLE' && obj.points && obj.points.length >= 4) {
                const p0 = obj.points[0], p1 = obj.points[1], p2 = obj.points[2], p3 = obj.points[3];
                const w = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
                const l = Math.hypot(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]);
                dimText = `W: ${w.toFixed(2)} cm × L: ${l.toFixed(2)} cm`;
                dimPos = [(p0[0] + p2[0]) / 2, 0.25, (p0[2] + p2[2]) / 2];
            } else if (obj.type === 'CIRCLE' && obj.points && obj.points.length >= 3) {
                let cx = 0, cz = 0;
                for (const p of obj.points) { cx += p[0]; cz += p[2]; }
                cx /= obj.points.length; cz /= obj.points.length;
                const r = Math.hypot(obj.points[0][0] - cx, 0, obj.points[0][2] - cz);
                dimText = `r: ${r.toFixed(2)} cm (Ø ${(r * 2).toFixed(2)} cm)`;
                dimPos = [cx, 0.25, cz];
            } else if (obj.points && obj.points.length >= 2) {
                let len = 0;
                for (let i = 1; i < obj.points.length; i++) {
                    len += Math.hypot(obj.points[i][0] - obj.points[i - 1][0], obj.points[i][1] - obj.points[i - 1][1], obj.points[i][2] - obj.points[i - 1][2]);
                }
                dimText = `L: ${len.toFixed(2)} cm`;
                dimPos = [obj.points[0][0], 0.25, obj.points[0][2]];
            }
        }

        return (
            <group>
                <line geometry={baseGeometry}>
                    <lineBasicMaterial color={color} linewidth={2} />
                </line>

                {dimText && (
                    <Text
                        position={dimPos}
                        fontSize={0.22}
                        color={isSelected ? '#ffea00' : '#00ffff'}
                        anchorX="center"
                        anchorY="bottom"
                    >
                        {dimText}
                    </Text>
                )}
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
    const cadObjects       = useCadStore((state) => state.cadObjects);
    const detectedProfiles = useCadStore((state) => state.detectedProfiles);
    const selectedObjectId = useCadStore((state) => state.selectedObjectId);
    const hoveredObjectId  = useCadStore((state) => state.hoveredObjectId);
    const drawingMode      = useCadStore((state) => state.drawingMode);
    const zHoldModeEnabled = useCadStore((state) => state.zHoldModeEnabled);
    const selectObject     = useCadStore((state) => state.selectObject);
    const selectedFace     = useCadStore((state) => state.selectedFace);
    const setSelectedFace  = useCadStore((state) => state.setSelectedFace);

    const revolveState     = useCadStore((state) => state.revolveState);
    const setRevolveProfile = useCadStore((state) => state.setRevolveProfile);
    const setRevolveAxis   = useCadStore((state) => state.setRevolveAxis);

    const handleObjectClick = (objId) => {
        if (revolveState?.active) {
            const obj = cadObjects.find((o) => o.id === objId);
            if (!obj) return;
            if (revolveState.step === 'SELECT_AXIS' && obj.type === 'LINE') {
                setRevolveAxis({
                    type: 'LINE',
                    lineId: obj.id,
                    points: obj.points || [obj.start, obj.end]
                });
            } else {
                // Resolve raw segment → owning SketchProfile
                const ownerProfile = detectedProfiles.find(p => p.segmentIds.includes(objId));
                setRevolveProfile(ownerProfile ? ownerProfile.id : objId);
            }
        } else {
            selectObject(objId);
        }
    };

    // Highlight all segments belonging to the selected SketchProfile
    const selectedSketchProfile = revolveState?.active
        ? detectedProfiles.find(p => p.id === revolveState.selectedProfileId)
        : null;

    const handleSelectSolidMesh = (obj, e) => {
        handleObjectClick(obj.id);
        if (!revolveState?.active && obj.extrudeHeight > 0.01 && e.face?.normal) {
            const face = getFaceFromHit(obj, e.face.normal, e.point);
            if (face) {
                setSelectedFace(face);
            }
        }
    };

    const isHitMeshActive = drawingMode === 'SELECT' || zHoldModeEnabled || (revolveState && revolveState.active);

    return (
        <group>
            {cadObjects.map((obj, idx) => {
                // Each object's points are plane-local. Apply the frozen creation-time
                // plane transform to convert them to world space.
                const pos = obj.planePosition || [0, 0, 0];
                const rot = obj.planeRotation || [Math.PI / 2, 0, 0];
                const inSelectedProfile = selectedSketchProfile?.segmentIds.includes(obj.id) ?? false;
                const isSelected = obj.id === selectedObjectId
                    || (revolveState?.active && revolveState.selectedProfileId === obj.id)
                    || inSelectedProfile;
                const isHovered = obj.id === hoveredObjectId;
                const isFaceSelected = selectedFace && selectedFace.objectId === obj.id;
                return (
                    <group key={obj.id || `cad-obj-${idx}`} position={pos} rotation={rot}>
                        <CadObjectItem
                            obj={obj}
                            isSelected={isSelected}
                            isHovered={isHovered}
                            isFaceSelected={isFaceSelected}
                            onSelectSolidMesh={handleSelectSolidMesh}
                        />
                        {isHitMeshActive && (
                            <SelectableHitMesh obj={obj} onSelect={handleObjectClick} />
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
