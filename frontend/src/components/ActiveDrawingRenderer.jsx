/**
 * ActiveDrawingRenderer.jsx - High-Frequency Direct Three.js Live Stroke Renderer
 * 
 * Renders in-progress drawing curves, straight lines, and rectangles using a pre-allocated
 * dynamic BufferGeometry with direct vertex buffer updates inside `useFrame()`.
 * 
 * ZERO React component recreation, ZERO array re-allocations during drawing.
 */

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_POINTS = 10000;

export function ActiveDrawingRenderer({ activeDrawingRef, drawingPointsRef }) {
    const lineMeshRef = useRef();
    const geometryRef = useRef();
    const positionsArray = useRef(new Float32Array(MAX_POINTS * 3)).current;

    useEffect(() => {
        if (!geometryRef.current) {
            const geom = new THREE.BufferGeometry();
            const posAttr = new THREE.BufferAttribute(positionsArray, 3);
            posAttr.setUsage(THREE.DynamicDrawUsage);
            geom.setAttribute('position', posAttr);
            geom.setDrawRange(0, 0);
            geometryRef.current = geom;
        }
    }, [positionsArray]);

    useFrame(() => {
        const activeDrawing = activeDrawingRef?.current;
        const geom = geometryRef.current;
        if (!geom) return;

        if (!activeDrawing || !activeDrawing.active) {
            if (geom.drawRange.count !== 0) {
                geom.setDrawRange(0, 0);
            }
            return;
        }

        const pts = drawingPointsRef?.current || [];
        const ptCount = pts.length;
        if (ptCount < 2) {
            geom.setDrawRange(0, 0);
            return;
        }

        const posAttr = geom.getAttribute('position');
        const array = posAttr.array;
        const type = activeDrawing.type || 'FREEHAND';

        if (type === 'FREEHAND') {
            const count = Math.min(ptCount, MAX_POINTS);
            for (let i = 0; i < count; i++) {
                const pt = pts[i];
                const idx = i * 3;
                array[idx] = pt[0];
                array[idx + 1] = pt[1];
                array[idx + 2] = pt[2];
            }
            geom.setDrawRange(0, count);
            posAttr.needsUpdate = true;
        } else if (type === 'LINE') {
            // Straight line: start point and latest point
            const start = pts[0];
            const end = pts[ptCount - 1];

            array[0] = start[0];
            array[1] = start[1];
            array[2] = start[2];

            array[3] = end[0];
            array[4] = end[1];
            array[5] = end[2];

            geom.setDrawRange(0, 2);
            posAttr.needsUpdate = true;
        } else if (type === 'RECTANGLE') {
            // Rectangle preview: 4 corners + closing vertex (5 vertices)
            const rectCorners = activeDrawing.previewCorners;
            if (rectCorners && rectCorners.length >= 4) {
                for (let i = 0; i < 4; i++) {
                    const c = rectCorners[i];
                    const idx = i * 3;
                    array[idx] = c[0];
                    array[idx + 1] = c[1];
                    array[idx + 2] = c[2];
                }
                // Close the rectangle loop
                array[12] = rectCorners[0][0];
                array[13] = rectCorners[0][1];
                array[14] = rectCorners[0][2];

                geom.setDrawRange(0, 5);
                posAttr.needsUpdate = true;
            } else {
                geom.setDrawRange(0, 0);
            }
        }
    });

    return (
        <line ref={lineMeshRef}>
            <bufferGeometry ref={geometryRef} />
            <lineBasicMaterial color="#ffea00" linewidth={3} depthTest={false} />
        </line>
    );
}
