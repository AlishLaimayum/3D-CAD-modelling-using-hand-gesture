/**
 * useZElongation.js - Z-Axis Elongation & Extrusion Controller for CAD Objects
 *
 * In Z-Hold Mode:
 * - Drawing is suppressed.
 * - Hovering over an object (e.g. Rectangle) shows an 'ns-resize' cursor.
 * - Clicking and dragging up/down elongates (extrudes) or de-elongates the shape in Z / Height.
 * - Rectangles turn into 3D Cubes/Boxes with solid shaded faces, wireframe CAD edges, and dimension readout.
 * - Releasing commits the new height via UpdateCADObjectCommand (fully undo-able & redo-able).
 * - OrbitControls is temporarily paused during drag so the camera doesn't spin.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCadStore } from '../store/useCadStore';

function findObjectAtLocalPoint(localPt, cadObjects) {
    if (!localPt) return null;
    let bestObj = null;
    let bestDist = Infinity;

    for (const obj of cadObjects) {
        if (obj.type === 'RECTANGLE' && obj.points && obj.points.length >= 4) {
            let minX = Infinity, maxX = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;
            for (const p of obj.points) {
                minX = Math.min(minX, p[0]);
                maxX = Math.max(maxX, p[0]);
                minZ = Math.min(minZ, p[2]);
                maxZ = Math.max(maxZ, p[2]);
            }
            const pad = 0.4;
            // Direct hit inside or right on the boundary of the rectangle
            if (localPt.x >= minX - pad && localPt.x <= maxX + pad &&
                localPt.z >= minZ - pad && localPt.z <= maxZ + pad) {
                return obj;
            }
            // Proximity to center
            const cx = (minX + maxX) / 2;
            const cz = (minZ + maxZ) / 2;
            const d = Math.hypot(localPt.x - cx, localPt.z - cz);
            if (d < bestDist && d < 2.5) {
                bestDist = d;
                bestObj = obj;
            }
        } else {
            const pts = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
            for (const p of pts) {
                const d = Math.hypot(localPt.x - p[0], localPt.z - p[2]);
                if (d < bestDist && d < 1.5) {
                    bestDist = d;
                    bestObj = obj;
                }
            }
        }
    }
    return bestObj;
}

export function useZElongation(controlsRef) {
    const { camera, gl } = useThree();

    const zHoldModeEnabled     = useCadStore((s) => s.zHoldModeEnabled);
    const cadObjects           = useCadStore((s) => s.cadObjects);
    const planePosition        = useCadStore((s) => s.planePosition);
    const planeRotation        = useCadStore((s) => s.planeRotation);
    const updateCADObject      = useCadStore((s) => s.updateCADObject);
    const internalUpdateObject = useCadStore((s) => s.internalUpdateObject);

    const zHoldRef         = useRef(zHoldModeEnabled);
    const objectsRef       = useRef(cadObjects);
    const planePosRef      = useRef(planePosition);
    const planeRotRef      = useRef(planeRotation);
    const updateRef        = useRef(updateCADObject);
    const internalRef      = useRef(internalUpdateObject);
    const controlsStoreRef = useRef(controlsRef);

    useEffect(() => { zHoldRef.current = zHoldModeEnabled; },       [zHoldModeEnabled]);
    useEffect(() => { objectsRef.current = cadObjects; },           [cadObjects]);
    useEffect(() => { planePosRef.current = planePosition; },       [planePosition]);
    useEffect(() => { planeRotRef.current = planeRotation; },       [planeRotation]);
    useEffect(() => { updateRef.current = updateCADObject; },       [updateCADObject]);
    useEffect(() => { internalRef.current = internalUpdateObject; }, [internalUpdateObject]);
    useEffect(() => { controlsStoreRef.current = controlsRef; },    [controlsRef]);

    const sessionRef = useRef({
        active: false,
        objectId: null,
        startClientY: 0,
        initialHeight: 0,
        lastHeight: 0,
    });

    const raycaster = useRef(new THREE.Raycaster()).current;
    const ndcVec    = useRef(new THREE.Vector2()).current;

    // Convert mouse/pointer event to working plane local coordinates
    const getPlaneIntersection = useCallback((event) => {
        const dom = gl.domElement;
        if (!dom) return null;
        const rect = dom.getBoundingClientRect();
        ndcVec.set(
            ((event.clientX - rect.left) / rect.width)  * 2 - 1,
            -((event.clientY - rect.top)  / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(ndcVec, camera);

        const rot = planeRotRef.current;
        const pos = planePosRef.current;

        const normal = new THREE.Vector3(0, 1, 0)
            .applyEuler(new THREE.Euler(rot[0], rot[1], rot[2]))
            .normalize();
        const planePosVec = new THREE.Vector3(pos[0], pos[1], pos[2]);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planePosVec);

        const hitWorld = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(plane, hitWorld)) return null;

        // Convert world hit to local coordinates on the working plane
        const local = hitWorld.clone().sub(planePosVec);
        const qInv = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]))
            .invert();
        local.applyQuaternion(qInv);
        local.y = 0; // enforce plane local y = 0

        return { world: hitWorld, local };
    }, [camera, gl.domElement, raycaster, ndcVec]);

    const onPointerDown = useCallback((event) => {
        if (event.button !== 0) return;
        if (!zHoldRef.current) return;

        const hit = getPlaneIntersection(event);
        if (!hit) return;

        const obj = findObjectAtLocalPoint(hit.local, objectsRef.current);
        if (!obj) return;

        // Target object found — begin Z-elongation session
        const currentHeight = Math.max(0, obj.extrudeHeight ?? ((obj.scaleZ && obj.scaleZ > 0.05 && obj.scaleZ !== 1) ? obj.scaleZ : 0));

        sessionRef.current = {
            active: true,
            objectId: obj.id,
            startClientY: event.clientY,
            initialHeight: currentHeight,
            lastHeight: currentHeight,
        };

        // Temporarily disable OrbitControls to avoid camera tumble while dragging
        if (controlsStoreRef.current?.current) {
            controlsStoreRef.current.current.enabled = false;
        }

        gl.domElement.style.cursor = 'ns-resize';
        event.stopPropagation();
    }, [getPlaneIntersection, gl.domElement]);

    const onPointerMove = useCallback((event) => {
        if (!zHoldRef.current) return;
        const sess = sessionRef.current;

        if (sess.active) {
            // Dragging: Moving mouse UP (smaller clientY) increases height (elongate)
            // Moving mouse DOWN (larger clientY) decreases height (delongate)
            const deltaPixels = sess.startClientY - event.clientY;
            const deltaHeight = deltaPixels * 0.018; // smooth, responsive sensitivity
            let newHeight = Math.max(0, sess.initialHeight + deltaHeight);
            
            // Clean snap to zero when close to plane
            if (newHeight < 0.05) newHeight = 0;
            newHeight = Math.round(newHeight * 100) / 100;

            sess.lastHeight = newHeight;

            internalRef.current(sess.objectId, {
                extrudeHeight: newHeight,
                scaleZ: newHeight > 0 ? newHeight : 1
            });

            gl.domElement.style.cursor = 'ns-resize';
            event.stopPropagation();
        } else {
            // Hover indicator in hold mode
            const hit = getPlaneIntersection(event);
            if (hit) {
                const hovered = findObjectAtLocalPoint(hit.local, objectsRef.current);
                gl.domElement.style.cursor = hovered ? 'ns-resize' : 'default';
            }
        }
    }, [getPlaneIntersection, gl.domElement]);

    const onPointerUp = useCallback(() => {
        const sess = sessionRef.current;
        if (!sess.active) return;

        const obj = objectsRef.current.find((o) => o.id === sess.objectId);
        if (obj) {
            updateRef.current(sess.objectId, {
                extrudeHeight: sess.lastHeight,
                scaleZ: sess.lastHeight > 0 ? sess.lastHeight : 1
            });
        }

        if (controlsStoreRef.current?.current) {
            controlsStoreRef.current.current.enabled = true;
        }

        gl.domElement.style.cursor = 'default';
        sessionRef.current = {
            active: false,
            objectId: null,
            startClientY: 0,
            initialHeight: 0,
            lastHeight: 0
        };
    }, [gl.domElement]);

    // Mouse wheel support when hovering over an object in hold mode
    const onWheel = useCallback((event) => {
        if (!zHoldRef.current) return;
        const hit = getPlaneIntersection(event);
        if (!hit) return;
        const obj = findObjectAtLocalPoint(hit.local, objectsRef.current);
        if (!obj) return;

        event.stopPropagation();
        event.preventDefault();

        const currentHeight = Math.max(0, obj.extrudeHeight ?? ((obj.scaleZ && obj.scaleZ > 0.05 && obj.scaleZ !== 1) ? obj.scaleZ : 0));
        const delta = -event.deltaY * 0.003;
        let newHeight = Math.max(0, currentHeight + delta);
        if (newHeight < 0.05) newHeight = 0;
        newHeight = Math.round(newHeight * 100) / 100;

        updateRef.current(obj.id, {
            extrudeHeight: newHeight,
            scaleZ: newHeight > 0 ? newHeight : 1
        });
    }, [getPlaneIntersection]);

    // WebSocket hand gesture integration
    const gesturePinchSessionRef = useRef({ active: false, objectId: null, startY: 0, initialHeight: 0 });

    const handleGesturePinchUpdate = useCallback((isPinching, cursorLocalPos, rawCursorY) => {
        if (!zHoldRef.current) return;
        const sess = gesturePinchSessionRef.current;

        if (isPinching) {
            if (!sess.active) {
                // Find object under gesture cursor
                const obj = findObjectAtLocalPoint(cursorLocalPos ? { x: cursorLocalPos[0], z: cursorLocalPos[2] } : null, objectsRef.current);
                if (obj) {
                    const currentHeight = Math.max(0, obj.extrudeHeight ?? ((obj.scaleZ && obj.scaleZ > 0.05 && obj.scaleZ !== 1) ? obj.scaleZ : 0));
                    gesturePinchSessionRef.current = {
                        active: true,
                        objectId: obj.id,
                        startY: rawCursorY,
                        initialHeight: currentHeight,
                    };
                }
            } else {
                // Pinch moving: moving hand UP (rawCursorY decreasing in camera frame) increases height
                const delta = (sess.startY - rawCursorY) * 6.0;
                let newHeight = Math.max(0, sess.initialHeight + delta);
                if (newHeight < 0.05) newHeight = 0;
                newHeight = Math.round(newHeight * 100) / 100;

                internalRef.current(sess.objectId, {
                    extrudeHeight: newHeight,
                    scaleZ: newHeight > 0 ? newHeight : 1
                });
            }
        } else if (sess.active) {
            // Pinch released: commit
            const obj = objectsRef.current.find((o) => o.id === sess.objectId);
            if (obj) {
                const finalHeight = obj.extrudeHeight ?? 0;
                updateRef.current(sess.objectId, {
                    extrudeHeight: finalHeight,
                    scaleZ: finalHeight > 0 ? finalHeight : 1
                });
            }
            gesturePinchSessionRef.current = { active: false, objectId: null, startY: 0, initialHeight: 0 };
        }
    }, []);

    // Bind DOM listeners when hold mode is active
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
        }

        return () => {
            el.removeEventListener('pointerdown', onPointerDown, { capture: true });
            el.removeEventListener('pointermove', onPointerMove, { capture: true });
            el.removeEventListener('wheel', onWheel);
            window.removeEventListener('pointerup', onPointerUp);
            el.style.cursor = 'default';
        };
    }, [zHoldModeEnabled, gl.domElement, onPointerDown, onPointerMove, onPointerUp, onWheel]);

    return { sessionRef, handleGesturePinchUpdate };
}
