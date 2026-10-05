/**
 * useZElongation.js - Z-Axis Elongation & Extrusion Controller for CAD Objects
 *
 * In Z-Hold Mode:
 * - Active tool behaves as SELECT. Drawing is suppressed.
 * - Moving hand / mouse over objects finds the closest object by projected edge distance and highlights it BEFORE pinch.
 * - When overlapping objects exist, chooses the object whose projected edges are closest to the pinch point.
 * - Pinching locks that highlighted object as the extrusion target.
 * - Moving pinch continuously extrudes along the object's creation-plane normal (XY -> ±Z, YZ -> ±X, XZ -> ±Y).
 * - Extrusion depth matches actual pinch position continuously with no arbitrary fixed limits.
 * - Dimension badge and solid mesh reuse the unified ExtrusionEngine pipeline.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCadStore } from '../store/useCadStore';

/**
 * Compute squared distance from 2D point (Qx, Qy) to 2D line segment (Ax, Ay)-(Bx, By).
 */
function distToSegmentSquared(Qx, Qy, Ax, Ay, Bx, By) {
    const vx = Bx - Ax;
    const vy = By - Ay;
    const wx = Qx - Ax;
    const wy = Qy - Ay;
    const lenSq = vx * vx + vy * vy;
    if (lenSq < 1e-8) {
        const dx = Qx - Ax;
        const dy = Qy - Ay;
        return dx * dx + dy * dy;
    }
    let t = (wx * vx + wy * vy) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const projX = Ax + t * vx;
    const projY = Ay + t * vy;
    const dx = Qx - projX;
    const dy = Qy - projY;
    return dx * dx + dy * dy;
}

/**
 * Extract all 3D feature edges of a CAD object transformed into world coordinates.
 */
function getObjectWorldEdges(obj) {
    const pos = obj.planePosition || [0, 0, 0];
    const rot = obj.planeRotation || [Math.PI / 2, 0, 0];
    const euler = new THREE.Euler(rot[0], rot[1], rot[2]);
    const quat = new THREE.Quaternion().setFromEuler(euler);
    const planePos = new THREE.Vector3(...pos);
    const matrix = new THREE.Matrix4().compose(planePos, quat, new THREE.Vector3(1, 1, 1));

    const height = Math.max(0, obj.extrudeHeight ?? ((obj.scaleZ !== undefined && obj.scaleZ > 0.05 && obj.scaleZ !== 1) ? obj.scaleZ : 0));

    // If SolidMesh edges are available and populated
    if (obj.solidMesh && obj.solidMesh.vertices && obj.solidMesh.edges && obj.solidMesh.edges.length > 0) {
        const vertsWorld = obj.solidMesh.vertices.map((v) =>
            new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(matrix)
        );
        return obj.solidMesh.edges.map((e) => [vertsWorld[e.v0], vertsWorld[e.v1]]);
    }

    // Otherwise construct boundary edges from profile points
    const pts = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
    if (!pts || pts.length < 2) return [];

    const isClosed = obj.type === 'RECTANGLE' || obj.type === 'CIRCLE' || (pts.length >= 3 && obj.isClosed);
    const N = pts.length;
    const baseWorld = pts.map((p) => new THREE.Vector3(p[0], 0, p[2]).applyMatrix4(matrix));

    const edges = [];
    const numSegments = isClosed ? N : N - 1;

    // Bottom loop edges
    for (let i = 0; i < numSegments; i++) {
        const next = (i + 1) % N;
        edges.push([baseWorld[i], baseWorld[next]]);
    }

    // If extruded, add top loop edges and vertical wall edges
    if (height > 0.01) {
        const topWorld = pts.map((p) => new THREE.Vector3(p[0], height, p[2]).applyMatrix4(matrix));
        for (let i = 0; i < numSegments; i++) {
            const next = (i + 1) % N;
            edges.push([topWorld[i], topWorld[next]]);
        }
        for (let i = 0; i < N; i++) {
            edges.push([baseWorld[i], topWorld[i]]);
        }
    }

    return edges;
}

/**
 * Determine the object whose projected edges are closest to the pinch point.
 * Solves overlapping object ambiguity by selecting the minimum screen-space distance.
 */
function findNearestObjectByProjectedEdges(ndcPoint, camera, aspect, cadObjects) {
    if (!ndcPoint || !cadObjects || cadObjects.length === 0) return null;

    const Qx = ndcPoint.x * aspect;
    const Qy = ndcPoint.y;

    let bestObj = null;
    let minOverallDistSq = Infinity;
    const MAX_DISTANCE_THRESHOLD = 0.35; // Proximity threshold in aspect-scaled NDC units
    const MAX_DISTANCE_THRESHOLD_SQ = MAX_DISTANCE_THRESHOLD * MAX_DISTANCE_THRESHOLD; // ~0.1225

    for (const obj of cadObjects) {
        const edges = getObjectWorldEdges(obj);
        if (edges.length === 0) continue;

        let minObjDistSq = Infinity;

        for (const [v0, v1] of edges) {
            const p0 = v0.clone().project(camera);
            const p1 = v1.clone().project(camera);

            // Skip edges behind camera
            if (p0.z > 1 && p1.z > 1) continue;

            const dSq = distToSegmentSquared(
                Qx, Qy,
                p0.x * aspect, p0.y,
                p1.x * aspect, p1.y
            );

            if (dSq < minObjDistSq) {
                minObjDistSq = dSq;
            }
        }

        if (minObjDistSq < minOverallDistSq && minObjDistSq < MAX_DISTANCE_THRESHOLD_SQ) {
            minOverallDistSq = minObjDistSq;
            bestObj = obj;
        }
    }

    return bestObj;
}

/**
 * Compute continuous extrusion depth along the object's creation-plane normal
 * based on the actual pinch / cursor ray.
 *
 * Creation-plane normal:
 * - XY -> ±Z
 * - YZ -> ±X
 * - XZ -> ±Y
 *
 * Solves for parameter s on extrusion axis L(s) = C_base + s * N closest to camera ray.
 */
function computeExtrusionDepth(ray, camera, obj, pinchAnchorPoint, ndc) {
    if (!ray || !obj) return 0;

    const pos = obj.planePosition || [0, 0, 0];
    const rot = obj.planeRotation || [Math.PI / 2, 0, 0];
    const euler = new THREE.Euler(rot[0], rot[1], rot[2]);

    // Creation-plane normal in world space (local +Y is extrusion axis: XY -> ±Z, YZ -> ±X, XZ -> ±Y)
    const normal = new THREE.Vector3(0, 1, 0).applyEuler(euler).normalize();
    const planePos = new THREE.Vector3(...pos);

    let anchor = pinchAnchorPoint;
    if (!anchor) {
        // Fallback to base centroid in plane-local space
        const pts = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
        let cx = 0, cz = 0;
        if (pts && pts.length > 0) {
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (const p of pts) {
                if (!p) continue;
                minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
                minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
            }
            cx = (minX + maxX) / 2;
            cz = (minZ + maxZ) / 2;
        }
        anchor = new THREE.Vector3(cx, 0, cz).applyEuler(euler).add(planePos);
    }

    // View-aligned extrusion plane: contains `normal` and faces the camera
    const viewDir = camera.getWorldDirection(new THREE.Vector3());
    const vPerp = new THREE.Vector3().crossVectors(viewDir, normal);
    let depth = 0;

    if (vPerp.lengthSq() > 1e-4) {
        vPerp.normalize();
        const planeNormal = new THREE.Vector3().crossVectors(vPerp, normal).normalize();
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, anchor);
        const hit = new THREE.Vector3();
        if (ray.intersectPlane(plane, hit)) {
            depth = Math.abs(hit.clone().sub(planePos).dot(normal));
        }
    }

    // Fallback if camera is looking directly along normal or plane intersection missed
    if (depth < 0.001) {
        const p0 = anchor.clone().project(camera);
        const p1 = anchor.clone().add(normal).project(camera);
        const vScreen = new THREE.Vector2(p1.x - p0.x, p1.y - p0.y);
        const lenSq = vScreen.lengthSq();

        if (lenSq > 1e-4) {
            const currentNdc = ndc || { x: p0.x, y: p0.y };
            const deltaScreen = new THREE.Vector2(currentNdc.x - p0.x, currentNdc.y - p0.y);
            depth = Math.abs(deltaScreen.dot(vScreen) / lenSq);
        } else {
            const currentNdc = ndc || { x: p0.x, y: p0.y };
            const dist = camera.position.distanceTo(anchor);
            const fovRad = (camera.fov || 50) * (Math.PI / 180);
            const worldHeightAtDist = 2 * dist * Math.tan(fovRad / 2);
            const deltaY = currentNdc.y - p0.y;
            depth = Math.max(0, deltaY * (worldHeightAtDist / 2));
        }
    }

    let cleanHeight = depth < 0.05 ? 0 : Math.round(depth * 100) / 100;
    return cleanHeight;
}

export function useZElongation(controlsRef) {
    const { camera, gl } = useThree();

    const zHoldModeEnabled     = useCadStore((s) => s.zHoldModeEnabled);
    const cadObjects           = useCadStore((s) => s.cadObjects);
    const selectedObjectId     = useCadStore((s) => s.selectedObjectId);
    const hoveredObjectId      = useCadStore((s) => s.hoveredObjectId);
    const updateCADObject      = useCadStore((s) => s.updateCADObject);
    const internalUpdateObject = useCadStore((s) => s.internalUpdateObject);
    const selectObject         = useCadStore((s) => s.selectObject);
    const setHoveredObjectId   = useCadStore((s) => s.setHoveredObjectId);
    const setDrawingMode       = useCadStore((s) => s.setDrawingMode);

    const zHoldRef              = useRef(zHoldModeEnabled);
    const objectsRef            = useRef(cadObjects);
    const selectedIdRef         = useRef(selectedObjectId);
    const hoveredIdRef          = useRef(hoveredObjectId);
    const updateRef             = useRef(updateCADObject);
    const internalRef           = useRef(internalUpdateObject);
    const controlsStoreRef      = useRef(controlsRef);
    const selectObjectRef       = useRef(selectObject);
    const setHoveredObjectIdRef = useRef(setHoveredObjectId);
    const setDrawingModeRef     = useRef(setDrawingMode);

    useEffect(() => { zHoldRef.current = zHoldModeEnabled; },           [zHoldModeEnabled]);
    useEffect(() => { objectsRef.current = cadObjects; },               [cadObjects]);
    useEffect(() => { selectedIdRef.current = selectedObjectId; },     [selectedObjectId]);
    useEffect(() => { hoveredIdRef.current = hoveredObjectId; },        [hoveredObjectId]);
    useEffect(() => { updateRef.current = updateCADObject; },           [updateCADObject]);
    useEffect(() => { internalRef.current = internalUpdateObject; },     [internalUpdateObject]);
    useEffect(() => { controlsStoreRef.current = controlsRef; },        [controlsRef]);
    useEffect(() => { selectObjectRef.current = selectObject; },        [selectObject]);
    useEffect(() => { setHoveredObjectIdRef.current = setHoveredObjectId; }, [setHoveredObjectId]);
    useEffect(() => { setDrawingModeRef.current = setDrawingMode; },     [setDrawingMode]);

    const sessionRef = useRef({
        active: false,
        objectId: null,
        startNdcY: 0,
        initialHeight: 0,
        lastHeight: 0
    });

    const gesturePinchSessionRef = useRef({
        active: false,
        objectId: null,
        startNdcY: 0,
        initialHeight: 0,
        lastHeight: 0
    });

    const raycaster = useRef(new THREE.Raycaster()).current;
    const ndcVec    = useRef(new THREE.Vector2()).current;

    // Helper: calculate aspect ratio of viewport
    const getAspect = useCallback(() => {
        const dom = gl.domElement;
        if (!dom) return camera.aspect || 1;
        return dom.clientWidth / Math.max(1, dom.clientHeight);
    }, [camera, gl.domElement]);

    // Pointer Down: Lock highlighted object as extrusion target
    const onPointerDown = useCallback((event) => {
        if (event.button !== 0) return;
        if (!zHoldRef.current) return;

        const dom = gl.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        const ndc = {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1
        };
        const aspect = rect.width / Math.max(1, rect.height);

        // Find highlighted target object by projected edge distance
        let obj = null;
        if (hoveredIdRef.current) {
            obj = objectsRef.current.find((o) => o.id === hoveredIdRef.current);
        }
        if (!obj && selectedIdRef.current) {
            const selObj = objectsRef.current.find((o) => o.id === selectedIdRef.current);
            if (selObj && findNearestObjectByProjectedEdges(ndc, camera, aspect, [selObj])) {
                obj = selObj;
            }
        }
        if (!obj) {
            obj = findNearestObjectByProjectedEdges(ndc, camera, aspect, objectsRef.current);
        }
        if (!obj) return;

        // Auto-select: active tool behaves as SELECT
        setDrawingModeRef.current('SELECT');
        selectObjectRef.current(obj.id);
        setHoveredObjectIdRef.current(obj.id);

        const currentHeight = obj.extrudeHeight || 0;
        sessionRef.current = {
            active: true,
            objectId: obj.id,
            startNdcY: ndc.y,
            initialHeight: currentHeight,
            lastHeight: currentHeight
        };

        if (controlsStoreRef.current?.current) {
            controlsStoreRef.current.current.enabled = false;
        }

        dom.style.cursor = 'ns-resize';
        event.stopPropagation();
    }, [camera, gl.domElement]);

    // Pointer Move: Before pinch -> highlight nearest object; During pinch -> continuous live extrusion
    const onPointerMove = useCallback((event) => {
        if (!zHoldRef.current) return;
        const sess = sessionRef.current;
        const dom = gl.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        const ndc = {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1
        };
        const aspect = rect.width / Math.max(1, rect.height);

        if (sess.active) {
            // Drag UP (ndc.y increases) -> extrude towards +Z (+ height)
            // Drag DOWN (ndc.y decreases) -> extrude downwards (- height)
            const targetObj = objectsRef.current.find((o) => o.id === sess.objectId);
            if (targetObj) {
                const deltaY = ndc.y - sess.startNdcY;
                const SENSITIVITY = 7.5;
                let newHeight = Math.max(0, sess.initialHeight + deltaY * SENSITIVITY);
                if (newHeight < 0.05) newHeight = 0;
                newHeight = Math.round(newHeight * 100) / 100;

                sess.lastHeight = newHeight;
                internalRef.current(sess.objectId, {
                    extrudeHeight: newHeight,
                    scaleZ: newHeight > 0 ? newHeight : 1
                });
            }

            dom.style.cursor = 'ns-resize';
            event.stopPropagation();
        } else {
            // Hover before pinch: determine closest object by projected edge distance
            const hovered = findNearestObjectByProjectedEdges(ndc, camera, aspect, objectsRef.current);
            setHoveredObjectIdRef.current(hovered ? hovered.id : null);
            dom.style.cursor = hovered ? 'ns-resize' : 'default';
        }
    }, [camera, gl.domElement]);

    // Pointer Up: Commit extrusion with undo support
    const onPointerUp = useCallback(() => {
        const sess = sessionRef.current;
        if (!sess.active) return;

        const obj = objectsRef.current.find((o) => o.id === sess.objectId);
        if (obj) {
            const finalHeight = sess.lastHeight;
            updateRef.current(sess.objectId, {
                extrudeHeight: finalHeight,
                scaleZ: finalHeight > 0 ? finalHeight : 1
            });
        }

        if (controlsStoreRef.current?.current) {
            controlsStoreRef.current.current.enabled = true;
        }

        sessionRef.current = {
            active: false,
            objectId: null,
            startNdcY: 0,
            initialHeight: 0,
            lastHeight: 0
        };
    }, []);

    // Mouse Wheel support
    const onWheel = useCallback((event) => {
        if (!zHoldRef.current) return;
        const dom = gl.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        const ndc = {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1
        };
        const aspect = rect.width / Math.max(1, rect.height);
        const obj = findNearestObjectByProjectedEdges(ndc, camera, aspect, objectsRef.current);
        if (!obj) return;

        event.stopPropagation();
        event.preventDefault();

        const currentHeight = Math.max(0, obj.extrudeHeight ?? 0);
        const delta = -event.deltaY * 0.005;
        let newHeight = Math.max(0, currentHeight + delta);
        if (newHeight < 0.05) newHeight = 0;
        newHeight = Math.round(newHeight * 100) / 100;

        updateRef.current(obj.id, {
            extrudeHeight: newHeight,
            scaleZ: newHeight > 0 ? newHeight : 1
        });
    }, [camera, gl.domElement]);

    // WebSocket hand gesture integration
    const handleGesturePinchUpdate = useCallback((isPinching, cursorArg, rawY) => {
        if (!zHoldRef.current) return;
        const sess = gesturePinchSessionRef.current;
        const aspect = getAspect();

        // Normalize cursor input: accepts { x, y } in NDC or normalized [0, 1]
        let ndc = null;
        if (cursorArg) {
            if (typeof cursorArg.x === 'number' && typeof cursorArg.y === 'number') {
                // If coordinates are in [0, 1], map to NDC [-1, 1]
                if (cursorArg.x >= 0 && cursorArg.x <= 1 && cursorArg.y >= 0 && cursorArg.y <= 1 && rawY === undefined) {
                    ndc = { x: cursorArg.x * 2 - 1, y: -(cursorArg.y * 2) + 1 };
                } else {
                    ndc = { x: cursorArg.x, y: cursorArg.y };
                }
            } else if (Array.isArray(cursorArg) && typeof rawY === 'number') {
                ndc = { x: (cursorArg[0] || 0), y: -(rawY * 2) + 1 };
            }
        }

        if (!ndc) {
            if (sess.active) {
                const finalHeight = sess.lastHeight;
                updateRef.current(sess.objectId, {
                    extrudeHeight: finalHeight,
                    scaleZ: finalHeight > 0 ? finalHeight : 1
                });
                gesturePinchSessionRef.current = {
                    active: false,
                    objectId: null,
                    startNdcY: 0,
                    initialHeight: 0,
                    lastHeight: 0
                };
            }
            setHoveredObjectIdRef.current(null);
            return;
        }

        if (isPinching) {
            if (!sess.active) {
                // User pinches: lock highlighted object as selected extrusion target
                let targetObj = null;
                if (hoveredIdRef.current) {
                    targetObj = objectsRef.current.find((o) => o.id === hoveredIdRef.current);
                }
                if (!targetObj && selectedIdRef.current) {
                    const sel = objectsRef.current.find((o) => o.id === selectedIdRef.current);
                    if (sel && findNearestObjectByProjectedEdges(ndc, camera, aspect, [sel])) {
                        targetObj = sel;
                    }
                }
                if (!targetObj) {
                    targetObj = findNearestObjectByProjectedEdges(ndc, camera, aspect, objectsRef.current);
                }

                if (targetObj) {
                    setDrawingModeRef.current('SELECT');
                    selectObjectRef.current(targetObj.id);
                    setHoveredObjectIdRef.current(targetObj.id);

                    const currentHeight = targetObj.extrudeHeight || 0;
                    gesturePinchSessionRef.current = {
                        active: true,
                        objectId: targetObj.id,
                        startNdcY: ndc.y,
                        initialHeight: currentHeight,
                        lastHeight: currentHeight
                    };
                }
            } else {
                // Live extrusion tracking: pinch moving up increases +Z, pinch moving down decreases towards 0
                const targetObj = objectsRef.current.find((o) => o.id === sess.objectId);
                if (targetObj) {
                    const deltaY = ndc.y - sess.startNdcY;
                    let newHeight = Math.max(0, sess.initialHeight + deltaY * 7.5);
                    if (newHeight < 0.05) newHeight = 0;
                    newHeight = Math.round(newHeight * 100) / 100;

                    sess.lastHeight = newHeight;
                    internalRef.current(sess.objectId, {
                        extrudeHeight: newHeight,
                        scaleZ: newHeight > 0 ? newHeight : 1
                    });
                }
            }
        } else {
            if (sess.active) {
                // User unpinches: save the extrusion permanently and stop extruding
                const finalHeight = sess.lastHeight;
                updateRef.current(sess.objectId, {
                    extrudeHeight: finalHeight,
                    scaleZ: finalHeight > 0 ? finalHeight : 1
                });
                gesturePinchSessionRef.current = {
                    active: false,
                    objectId: null,
                    startNdcY: 0,
                    initialHeight: 0,
                    lastHeight: 0
                };
            }

            // Before pinch: determine nearest object by projected edges and highlight it
            const nearest = findNearestObjectByProjectedEdges(ndc, camera, aspect, objectsRef.current);
            setHoveredObjectIdRef.current(nearest ? nearest.id : null);
        }
    }, [camera, getAspect]);

    // Manage DOM listeners and cursor reset on mode change
    useEffect(() => {
        const el = gl.domElement;
        if (!el) return;

        if (zHoldModeEnabled) {
            el.addEventListener('pointerdown', onPointerDown, { capture: true });
            el.addEventListener('pointermove', onPointerMove, { capture: true });
            el.addEventListener('wheel', onWheel, { passive: false });
            window.addEventListener('pointerup', onPointerUp);
        } else {
            el.style.cursor = 'default';
            setHoveredObjectIdRef.current(null);
        }

        return () => {
            el.removeEventListener('pointerdown', onPointerDown, { capture: true });
            el.removeEventListener('pointermove', onPointerMove, { capture: true });
            el.removeEventListener('wheel', onWheel);
            window.removeEventListener('pointerup', onPointerUp);
            el.style.cursor = 'default';
            setHoveredObjectIdRef.current(null);
        };
    }, [zHoldModeEnabled, gl.domElement, onPointerDown, onPointerMove, onPointerUp, onWheel]);

    return { sessionRef, handleGesturePinchUpdate };
}
