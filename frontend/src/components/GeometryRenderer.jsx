/**
 * GeometryRenderer.jsx - Render Completed CAD Objects & Direct High-Frequency Interaction
 * 
 * 1. Efficiently renders completed CAD objects (Freehand curves, Lines, Rectangles).
 * 2. Uses memoized BufferGeometries to eliminate garbage collection on static objects.
 * 3. Mounts CursorRenderer and ActiveDrawingRenderer for zero-rerender active drawing.
 */

import { useMemo, memo } from 'react';
import * as THREE from 'three';
import { useCadStore } from '../store/useCadStore';
import { CursorRenderer } from './CursorRenderer';
import { ActiveDrawingRenderer } from './ActiveDrawingRenderer';

/**
 * Individual CAD Object Mesh (Memoized for zero re-render overhead when new objects are added)
 */
const CadObjectItem = memo(function CadObjectItem({ obj }) {
    const geometry = useMemo(() => {
        if (!obj) return null;

        if (obj.points && obj.points.length > 0) {
            const pts = obj.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
            if (obj.type === 'RECTANGLE' && pts.length >= 4) {
                // Ensure loop is closed
                pts.push(new THREE.Vector3(pts[0].x, pts[0].y, pts[0].z));
            }
            return new THREE.BufferGeometry().setFromPoints(pts);
        } else if (obj.start && obj.end) {
            // Legacy line format
            const pts = [
                new THREE.Vector3(obj.start[0], obj.start[1], obj.start[2]),
                new THREE.Vector3(obj.end[0], obj.end[1], obj.end[2])
            ];
            return new THREE.BufferGeometry().setFromPoints(pts);
        }
        return null;
    }, [obj]);

    if (!geometry) return null;

    const color = obj.color || 0x00e5ff;

    return (
        <line geometry={geometry}>
            <lineBasicMaterial color={color} linewidth={2} />
        </line>
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
