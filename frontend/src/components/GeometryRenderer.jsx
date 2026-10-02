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

/**
 * Individual CAD Object Mesh (Extrudes 2D profiles into 3D solids when elongated)
 */
const CadObjectItem = memo(function CadObjectItem({ obj }) {
    const color = obj.color || 0x00e5ff;
    const height = Math.max(0, obj.extrudeHeight ?? ((obj.scaleZ !== undefined && obj.scaleZ > 0.05 && obj.scaleZ !== 1) ? obj.scaleZ : 0));

    // Calculate planar bounds for rectangles
    const rectBounds = useMemo(() => {
        if (obj.type !== 'RECTANGLE' || !obj.points || obj.points.length < 4) return null;
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (const p of obj.points) {
            minX = Math.min(minX, p[0]);
            maxX = Math.max(maxX, p[0]);
            minZ = Math.min(minZ, p[2]);
            maxZ = Math.max(maxZ, p[2]);
        }
        const width = Math.max(0.01, maxX - minX);
        const depth = Math.max(0.01, maxZ - minZ);
        const centerX = (minX + maxX) / 2;
        const centerZ = (minZ + maxZ) / 2;
        return { minX, maxX, minZ, maxZ, width, depth, centerX, centerZ };
    }, [obj.type, obj.points]);

    // 2D Profile loop geometry (sketch outline at base)
    const baseGeometry = useMemo(() => {
        if (!obj) return null;

        if (obj.points && obj.points.length > 0) {
            const pts = obj.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
            if (obj.type === 'RECTANGLE' && pts.length >= 4) {
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

    // 3D Extruded wall geometry for lines and freehand curves
    const extrudedWallGeometry = useMemo(() => {
        if (height <= 0.01 || obj.type === 'RECTANGLE') return null;
        const pts = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
        if (pts.length < 2) return null;

        const vertices = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];

            // 2 triangles per segment (vertical extruded wall)
            vertices.push(
                p1[0], 0, p1[2],
                p2[0], 0, p2[2],
                p2[0], height, p2[2],

                p1[0], 0, p1[2],
                p2[0], height, p2[2],
                p1[0], height, p1[2]
            );
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.computeVertexNormals();
        return geom;
    }, [obj, height]);

    if (!baseGeometry) return null;

    // ---------------------------------------------------------
    // 3D SOLID CUBE / BOX (When a Rectangle is Elongated in Z)
    // ---------------------------------------------------------
    if (obj.type === 'RECTANGLE' && rectBounds && height > 0.01) {
        const { width, depth, centerX, centerZ, maxX } = rectBounds;
        const boxCenter = [centerX, height / 2, centerZ];

        return (
            <group>
                {/* Solid translucent CAD Box Mesh */}
                <mesh position={boxCenter} castShadow receiveShadow>
                    <boxGeometry args={[width, height, depth]} />
                    <meshStandardMaterial
                        color={color}
                        transparent
                        opacity={0.62}
                        roughness={0.25}
                        metalness={0.2}
                        side={THREE.DoubleSide}
                    />
                </mesh>

                {/* Crisp Glowing CAD Edge Lines for all 12 Box Edges */}
                <lineSegments position={boxCenter}>
                    <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
                    <lineBasicMaterial color="#ffffff" linewidth={2} />
                </lineSegments>

                {/* Base 2D Sketch Outline on Plane */}
                <line geometry={baseGeometry}>
                    <lineBasicMaterial color={color} linewidth={2} />
                </line>

                {/* Height Dimension HUD Indicator */}
                <Text
                    position={[maxX + 0.35, height / 2, centerZ]}
                    fontSize={0.28}
                    color="#00ffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    {`H: ${height.toFixed(2)}`}
                </Text>
            </group>
        );
    }

    // ---------------------------------------------------------
    // 3D EXTRUDED WALL (For Lines & Freehand Curves)
    // ---------------------------------------------------------
    if (extrudedWallGeometry && height > 0.01) {
        return (
            <group>
                <mesh geometry={extrudedWallGeometry}>
                    <meshStandardMaterial
                        color={color}
                        transparent
                        opacity={0.6}
                        roughness={0.3}
                        side={THREE.DoubleSide}
                    />
                </mesh>
                <line geometry={baseGeometry}>
                    <lineBasicMaterial color={color} linewidth={2} />
                </line>
            </group>
        );
    }

    // ---------------------------------------------------------
    // 2D FLAT PROFILE (Default before Elongation)
    // ---------------------------------------------------------
    return (
        <group>
            <line geometry={baseGeometry}>
                <lineBasicMaterial color={color} linewidth={2} />
            </line>
        </group>
    );
});

export function GeometryRenderer({ cursorPosRef, snapInfoRef, activeDrawingRef, drawingPointsRef }) {
    // Only subscribe to completed CAD objects list
    const cadObjects = useCadStore((state) => state.cadObjects);

    return (
        <group>
            {/* Completed CAD Objects (Lines, Freehand curves, Rectangles) */}
            {cadObjects.map((obj, idx) => (
                <CadObjectItem key={obj.id || `cad-obj-${idx}`} obj={obj} />
            ))}

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
