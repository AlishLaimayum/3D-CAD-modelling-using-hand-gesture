/**
 * ActiveDrawingRenderer.jsx - High-Frequency Direct Three.js Live Stroke Renderer
 * 
 * Renders in-progress drawing curves, straight lines, rectangles, and circles using a pre-allocated
 * dynamic BufferGeometry with direct vertex buffer updates inside `useFrame()`.
 * 
 * ZERO React component recreation, ZERO array re-allocations during drawing.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_POINTS = 10000;

export function ActiveDrawingRenderer({ activeDrawingRef, drawingPointsRef, cursorPosRef }) {
    const lineMeshRef = useRef();
    const materialRef = useRef();

    // Visual feedback refs for CURVE tool
    const p0MarkerRef = useRef();
    const p3MarkerRef = useRef();
    const handleMarkerRef = useRef();
    const controlLineRef = useRef();
    const controlLineGeomRef = useRef();

    // Allocate dynamic BufferGeometry with position attribute directly (no race conditions)
    const { geometry, positionsArray } = useMemo(() => {
        const positions = new Float32Array(MAX_POINTS * 3);
        const geom = new THREE.BufferGeometry();
        const posAttr = new THREE.BufferAttribute(positions, 3);
        posAttr.setUsage(THREE.DynamicDrawUsage);
        geom.setAttribute('position', posAttr);
        geom.setDrawRange(0, 0);
        return { geometry: geom, positionsArray: positions };
    }, []);

    // Clean up GPU buffers on unmount
    useEffect(() => {
        return () => {
            geometry.dispose();
            controlLineGeomRef.current?.dispose();
        };
    }, [geometry]);

    useFrame(() => {
        const activeDrawing = activeDrawingRef?.current;
        if (!activeDrawing || !activeDrawing.active) {
            if (geometry.drawRange.count !== 0) {
                geometry.setDrawRange(0, 0);
            }
            if (p0MarkerRef.current) p0MarkerRef.current.visible = false;
            if (p3MarkerRef.current) p3MarkerRef.current.visible = false;
            if (handleMarkerRef.current) handleMarkerRef.current.visible = false;
            if (controlLineRef.current) controlLineRef.current.visible = false;
            return;
        }

        const pts = drawingPointsRef?.current || [];
        const ptCount = pts.length;
        const currentCursor = cursorPosRef?.current;

        if (ptCount === 0 && !currentCursor && !activeDrawing.p0) {
            if (geometry.drawRange.count !== 0) {
                geometry.setDrawRange(0, 0);
            }
            if (p0MarkerRef.current) p0MarkerRef.current.visible = false;
            if (p3MarkerRef.current) p3MarkerRef.current.visible = false;
            if (handleMarkerRef.current) handleMarkerRef.current.visible = false;
            if (controlLineRef.current) controlLineRef.current.visible = false;
            return;
        }

        const type = activeDrawing.type || 'FREEHAND';
        const posAttr = geometry.getAttribute('position');
        const array = positionsArray;

        // Dynamic visual feedback: neon yellow while drawing, neon green when shape is perfected, neon cyan for curve
        if (materialRef.current) {
            if (type === 'CURVE') {
                materialRef.current.color.set('#00f0ff');
            } else if (activeDrawing.shapePerfected) {
                materialRef.current.color.set('#00ff88');
            } else {
                materialRef.current.color.set('#ffea00');
            }
        }

        if (type === 'CURVE') {
            const stage = activeDrawing.curveStage;
            if (stage === 'WAITING_FOR_END') {
                const start = activeDrawing.p0 || pts[0];
                const end = currentCursor || start;
                if (start && end) {
                    array[0] = start[0]; array[1] = start[1]; array[2] = start[2];
                    array[3] = end[0];   array[4] = end[1];   array[5] = end[2];
                    geometry.setDrawRange(0, 2);
                    posAttr.needsUpdate = true;
                }

                if (p0MarkerRef.current && start) {
                    p0MarkerRef.current.position.set(start[0], start[1], start[2]);
                    p0MarkerRef.current.visible = true;
                }
                if (p3MarkerRef.current) p3MarkerRef.current.visible = false;
                if (handleMarkerRef.current) handleMarkerRef.current.visible = false;
                if (controlLineRef.current) controlLineRef.current.visible = false;
            } else if (stage === 'SHAPING_CURVE') {
                const curvePts = activeDrawing.previewPoints || [];
                if (curvePts.length >= 2) {
                    const count = Math.min(curvePts.length, MAX_POINTS);
                    for (let i = 0; i < count; i++) {
                        const p = curvePts[i];
                        array[i * 3]     = p[0];
                        array[i * 3 + 1] = p[1];
                        array[i * 3 + 2] = p[2];
                    }
                    geometry.setDrawRange(0, count);
                    posAttr.needsUpdate = true;
                }

                const p0 = activeDrawing.p0;
                const p3 = activeDrawing.p3;
                const h  = activeDrawing.handle;
                const p1 = activeDrawing.p1;
                const p2 = activeDrawing.p2;

                if (p0MarkerRef.current && p0) {
                    p0MarkerRef.current.position.set(p0[0], p0[1], p0[2]);
                    p0MarkerRef.current.visible = true;
                }
                if (p3MarkerRef.current && p3) {
                    p3MarkerRef.current.position.set(p3[0], p3[1], p3[2]);
                    p3MarkerRef.current.visible = true;
                }
                if (handleMarkerRef.current && h) {
                    handleMarkerRef.current.position.set(h[0], h[1], h[2]);
                    handleMarkerRef.current.visible = true;
                }
                if (controlLineRef.current && controlLineGeomRef.current && p0 && p1 && p2 && p3) {
                    const ctrlPts = [
                        new THREE.Vector3(...p0),
                        new THREE.Vector3(...p1),
                        new THREE.Vector3(...p2),
                        new THREE.Vector3(...p3)
                    ];
                    controlLineGeomRef.current.setFromPoints(ctrlPts);
                    controlLineRef.current.visible = true;
                }
            } else {
                geometry.setDrawRange(0, 0);
                if (p0MarkerRef.current) p0MarkerRef.current.visible = false;
                if (p3MarkerRef.current) p3MarkerRef.current.visible = false;
                if (handleMarkerRef.current) handleMarkerRef.current.visible = false;
                if (controlLineRef.current) controlLineRef.current.visible = false;
            }
        } else {
            // Hide curve markers for non-curve modes
            if (p0MarkerRef.current) p0MarkerRef.current.visible = false;
            if (p3MarkerRef.current) p3MarkerRef.current.visible = false;
            if (handleMarkerRef.current) handleMarkerRef.current.visible = false;
            if (controlLineRef.current) controlLineRef.current.visible = false;

            if (type === 'FREEHAND') {
                if (activeDrawing.shapePerfected && ptCount >= 3) {
                    // When hold-to-perfect triggers, render the perfected shape as a closed loop
                    const count = Math.min(ptCount, MAX_POINTS - 1);
                    for (let i = 0; i < count; i++) {
                        const idx = i * 3;
                        array[idx] = pts[i][0];
                        array[idx + 1] = pts[i][1];
                        array[idx + 2] = pts[i][2];
                    }
                    // Close loop
                    const lastIdx = count * 3;
                    array[lastIdx] = pts[0][0];
                    array[lastIdx + 1] = pts[0][1];
                    array[lastIdx + 2] = pts[0][2];

                    geometry.setDrawRange(0, count + 1);
                    posAttr.needsUpdate = true;
                } else if (ptCount === 1) {
                    // First point down: draw line from start point to live cursor tip
                    const start = pts[0];
                    const end = currentCursor || start;
                    array[0] = start[0];
                    array[1] = start[1];
                    array[2] = start[2];
                    array[3] = end[0];
                    array[4] = end[1];
                    array[5] = end[2];

                    geometry.setDrawRange(0, 2);
                    posAttr.needsUpdate = true;
                } else if (ptCount >= 2) {
                    let count = Math.min(ptCount, MAX_POINTS - 1);
                    for (let i = 0; i < count; i++) {
                        const pt = pts[i];
                        const idx = i * 3;
                        array[idx] = pt[0];
                        array[idx + 1] = pt[1];
                        array[idx + 2] = pt[2];
                    }

                    // Connect to real-time cursor tip for ultra-responsive 60 FPS feedback
                    if (currentCursor && count < MAX_POINTS) {
                        const idx = count * 3;
                        array[idx] = currentCursor[0];
                        array[idx + 1] = currentCursor[1];
                        array[idx + 2] = currentCursor[2];
                        count++;
                    }

                    geometry.setDrawRange(0, count);
                    posAttr.needsUpdate = true;
                } else {
                    geometry.setDrawRange(0, 0);
                }
            } else if (type === 'LINE') {
                // Straight line: start point to current cursor / last point
                const start = pts[0];
                const end = currentCursor || pts[ptCount - 1];

                if (start && end) {
                    array[0] = start[0];
                    array[1] = start[1];
                    array[2] = start[2];
                    array[3] = end[0];
                    array[4] = end[1];
                    array[5] = end[2];

                    geometry.setDrawRange(0, 2);
                    posAttr.needsUpdate = true;
                } else {
                    geometry.setDrawRange(0, 0);
                }
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

                    geometry.setDrawRange(0, 5);
                    posAttr.needsUpdate = true;
                } else if (pts[0] && currentCursor) {
                    // Fallback line preview before rectangle corners calculation
                    const start = pts[0];
                    array[0] = start[0];
                    array[1] = start[1];
                    array[2] = start[2];
                    array[3] = currentCursor[0];
                    array[4] = currentCursor[1];
                    array[5] = currentCursor[2];

                    geometry.setDrawRange(0, 2);
                    posAttr.needsUpdate = true;
                } else {
                    geometry.setDrawRange(0, 0);
                }
            } else if (type === 'CIRCLE') {
                // Circle preview: up to 65 points (64 segments + closing point)
                const circlePts = activeDrawing.previewCircle;
                if (circlePts && circlePts.length >= 2) {
                    const count = Math.min(circlePts.length, MAX_POINTS);
                    for (let i = 0; i < count; i++) {
                        const c = circlePts[i];
                        array[i * 3]     = c[0];
                        array[i * 3 + 1] = c[1];
                        array[i * 3 + 2] = c[2];
                    }
                    geometry.setDrawRange(0, count);
                    posAttr.needsUpdate = true;
                } else if (pts[0] && currentCursor) {
                    // Fallback: show radius line before first move
                    const start = pts[0];
                    array[0] = start[0]; array[1] = start[1]; array[2] = start[2];
                    array[3] = currentCursor[0]; array[4] = currentCursor[1]; array[5] = currentCursor[2];
                    geometry.setDrawRange(0, 2);
                    posAttr.needsUpdate = true;
                } else {
                    geometry.setDrawRange(0, 0);
                }
            }
        }
    });

    return (
        <group>
            {/* Live Stroke Preview Line */}
            <line ref={lineMeshRef} geometry={geometry} frustumCulled={false} renderOrder={1000}>
                <lineBasicMaterial
                    ref={materialRef}
                    color="#ffea00"
                    linewidth={3}
                    depthTest={false}
                    depthWrite={false}
                    transparent={true}
                    opacity={1}
                />
            </line>

            {/* CURVE Tool: Start Point Marker (P0) */}
            <mesh ref={p0MarkerRef} visible={false} renderOrder={1002}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial color="#00f0ff" depthTest={false} depthWrite={false} />
            </mesh>

            {/* CURVE Tool: Fixed Endpoint Marker (P3) */}
            <mesh ref={p3MarkerRef} visible={false} renderOrder={1002}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial color="#00ff88" depthTest={false} depthWrite={false} />
            </mesh>

            {/* CURVE Tool: Hand Control Handle (Diamond / Octahedron) */}
            <mesh ref={handleMarkerRef} visible={false} renderOrder={1002}>
                <octahedronGeometry args={[0.1]} />
                <meshBasicMaterial color="#ffaa00" depthTest={false} depthWrite={false} />
            </mesh>

            {/* CURVE Tool: Tangent / Control Polygon Lines */}
            <line ref={controlLineRef} visible={false} frustumCulled={false} renderOrder={1001}>
                <bufferGeometry ref={controlLineGeomRef} />
                <lineBasicMaterial color="#ffaa00" transparent opacity={0.6} linewidth={1} depthTest={false} depthWrite={false} />
            </line>
        </group>
    );
}
