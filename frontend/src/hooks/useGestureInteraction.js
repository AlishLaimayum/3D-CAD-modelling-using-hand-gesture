import { useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useCadStore } from '../store/useCadStore';

import PlaneManager from '../cad/PlaneManager';
import PlaneRotationController from '../cad/PlaneRotationController';

export function useGestureInteraction() {
    const { camera, gl } = useThree();

    // ---------------------------------------------
    // CAD MANAGERS
    // ---------------------------------------------
    const planeManagerRef = useRef(null);
    const rotationControllerRef = useRef(null);

    if (!planeManagerRef.current) {
        planeManagerRef.current = new PlaneManager();
        rotationControllerRef.current = new PlaneRotationController(planeManagerRef.current);
    }

    const planeManager = planeManagerRef.current;
    const rotationController = rotationControllerRef.current;

    // ---------------------------------------------
    // WEBSOCKET & THREE
    // ---------------------------------------------
    const wsRef = useRef(null);
    const raycaster = useRef(new THREE.Raycaster()).current;

    // ---------------------------------------------
    // STORE READS & ACTIONS
    // ---------------------------------------------
    const {
        setGestureState,
        setPlaneLocked,
        setPlaneRotation,
        setCursorPosition,
        setSnappedInfo,
        startLine,
        extendLine,
        finalizeLine,
        lines,
        magneticLockEnabled,
        snapDistance,
        planeRotation,
        planePosition
    } = useCadStore();

    // Sync plane manager rotation & position with store
    useEffect(() => {
        planeManager.setRotation(...planeRotation);
    }, [planeRotation, planeManager]);

    useEffect(() => {
        planeManager.setPosition(...planePosition);
    }, [planePosition, planeManager]);

    // Latest state in refs for listeners
    const linesRef = useRef(lines);
    linesRef.current = lines;

    const magneticLockEnabledRef = useRef(magneticLockEnabled);
    magneticLockEnabledRef.current = magneticLockEnabled;

    const snapDistanceRef = useRef(snapDistance);
    snapDistanceRef.current = snapDistance;

    const isPointerDrawingRef = useRef(false);
    const isGestureDrawingRef = useRef(false);
    const palmActiveRef = useRef(false);
    const previousSwipeRef = useRef(null);
    const previousGestureRef = useRef(null);
    const smoothPosRef = useRef(null);

    // ---------------------------------------------
    // MAGNETIC SNAP CALCULATOR (WORLD SPACE 3D)
    // ---------------------------------------------
    const applyMagneticSnap = useCallback((worldPos) => {
        if (!magneticLockEnabledRef.current) {
            setSnappedInfo({ isSnapped: false, point: null });
            return worldPos;
        }

        const currLines = linesRef.current || [];
        const threshold = snapDistanceRef.current || 0.25;
        let closestPt = null;
        let minDistanceSq = threshold * threshold;

        // Check all line start & end vertices in 3D space
        for (let i = 0; i < currLines.length; i++) {
            const line = currLines[i];
            const pts = [line.start, line.end];
            for (let j = 0; j < pts.length; j++) {
                const pt = pts[j];
                const dx = worldPos[0] - pt[0];
                const dy = worldPos[1] - pt[1];
                const dz = worldPos[2] - pt[2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    closestPt = [...pt];
                }
            }
        }

        if (closestPt) {
            setSnappedInfo({ isSnapped: true, point: closestPt });
            return closestPt;
        } else {
            setSnappedInfo({ isSnapped: false, point: null });
            return worldPos;
        }
    }, [setSnappedInfo]);

    // ---------------------------------------------
    // WEBSOCKET INTERACTION
    // ---------------------------------------------
    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8000/ws/tracking');
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('Connected to gesture server');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            setGestureState(data.state);
            setPlaneLocked(data.locked);
            planeManager.setLocked(data.locked);

            // PALM ROTATION
            if (data.state === 'OPEN_PALM') {
                if (!palmActiveRef.current) {
                    palmActiveRef.current = true;
                    rotationController.start();
                    previousSwipeRef.current = null;
                }

                if (data.swipe) {
                    const previous = previousSwipeRef.current;
                    if (previous) {
                        const dx = data.swipe.x - previous.x;
                        const dy = data.swipe.y - previous.y;
                        rotationController.update(dx, dy);
                        setPlaneRotation(planeManager.getRotation());
                    }
                    previousSwipeRef.current = { x: data.swipe.x, y: data.swipe.y };
                }
            } else {
                if (palmActiveRef.current) {
                    palmActiveRef.current = false;
                    rotationController.stop();
                    previousSwipeRef.current = null;
                }
            }

            // GESTURE RAYCAST & DRAW (WORLD SPACE)
            if (data.cursor) {
                const ndcX = data.cursor.x * 2 - 1;
                const ndcY = -(data.cursor.y * 2) + 1;

                raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

                const normal = planeManager.getNormal();
                const planePos = new THREE.Vector3(...planeManager.getPosition());
                const denom = raycaster.ray.direction.dot(normal);

                let pointWorld = null;
                if (Math.abs(denom) > 1e-6) {
                    const t = planePos.clone().sub(raycaster.ray.origin).dot(normal) / denom;
                    if (t >= 0) {
                        pointWorld = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(t));
                    }
                }

                if (pointWorld) {
                    const rawPos = [pointWorld.x, pointWorld.y, pointWorld.z];
                    
                    // 3D LERP smoothing for steady, jitter-free lines
                    if (!smoothPosRef.current) {
                        smoothPosRef.current = rawPos;
                    } else {
                        const lerpFactor = 0.35;
                        smoothPosRef.current = [
                            smoothPosRef.current[0] + (rawPos[0] - smoothPosRef.current[0]) * lerpFactor,
                            smoothPosRef.current[1] + (rawPos[1] - smoothPosRef.current[1]) * lerpFactor,
                            smoothPosRef.current[2] + (rawPos[2] - smoothPosRef.current[2]) * lerpFactor
                        ];
                    }

                    const finalPos = applyMagneticSnap(smoothPosRef.current);
                    setCursorPosition(finalPos);

                    if (data.state === 'PINCH' && data.locked) {
                        if (!isGestureDrawingRef.current) {
                            isGestureDrawingRef.current = true;
                            startLine(finalPos);
                            console.log('HAND GESTURE: Started Line at', finalPos);
                        } else {
                            extendLine(finalPos);
                        }
                    } else if (isGestureDrawingRef.current) {
                        isGestureDrawingRef.current = false;
                        finalizeLine();
                        console.log('HAND GESTURE: Finalized Line');
                    }
                } else if (isGestureDrawingRef.current && !(data.state === 'PINCH' && data.locked)) {
                    isGestureDrawingRef.current = false;
                    finalizeLine();
                }
            } else if (isGestureDrawingRef.current) {
                isGestureDrawingRef.current = false;
                finalizeLine();
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('Gesture WebSocket disconnected');
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [
        camera,
        setGestureState,
        setPlaneLocked,
        setPlaneRotation,
        setCursorPosition,
        startLine,
        extendLine,
        finalizeLine,
        applyMagneticSnap,
        planeManager,
        rotationController
    ]);

    // ---------------------------------------------
    // DUAL MOUSE & POINTER INTERACTION (DRAW & HOVER)
    // ---------------------------------------------
    useEffect(() => {
        const domElement = gl.domElement;
        if (!domElement) return;

        const getPlaneIntersection = (event) => {
            const rect = domElement.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
            const normal = planeManager.getNormal();
            const planePos = new THREE.Vector3(...planeManager.getPosition());
            const denom = raycaster.ray.direction.dot(normal);

            let pointWorld = null;
            if (Math.abs(denom) > 1e-6) {
                const t = planePos.clone().sub(raycaster.ray.origin).dot(normal) / denom;
                if (t >= 0) {
                    pointWorld = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(t));
                }
            }

            if (pointWorld) {
                const rawPos = [pointWorld.x, pointWorld.y, pointWorld.z];
                return applyMagneticSnap(rawPos);
            }
            return null;
        };

        const handlePointerMove = (event) => {
            const finalPos = getPlaneIntersection(event);
            if (finalPos) {
                setCursorPosition(finalPos);
                if (isPointerDrawingRef.current) {
                    extendLine(finalPos);
                }
            }
        };

        const handlePointerDown = (event) => {
            if (event.button === 0) {
                const finalPos = getPlaneIntersection(event);
                if (finalPos) {
                    isPointerDrawingRef.current = true;
                    startLine(finalPos);
                }
            }
        };

        const handlePointerUp = (event) => {
            if (isPointerDrawingRef.current) {
                isPointerDrawingRef.current = false;
                finalizeLine();
            }
        };

        domElement.addEventListener('pointermove', handlePointerMove);
        domElement.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            domElement.removeEventListener('pointermove', handlePointerMove);
            domElement.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [
        gl.domElement, 
        camera, 
        planeManager, 
        applyMagneticSnap, 
        setCursorPosition, 
        startLine, 
        extendLine, 
        finalizeLine
    ]);

    return null;
}