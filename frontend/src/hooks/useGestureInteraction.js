/**
 * useGestureInteraction.js - High-Performance Non-Reactive Interaction Controller
 * 
 * Orchestrates:
 * 1. WebSocket Tracking Stream & Latency Measurement (~30 FPS)
 * 2. Gesture State Machine with Hysteresis (PINCH, OPEN_PALM, FIST, IDLE)
 * 3. Position Smoothing & Deadzone Engine (smoothing.js)
 * 4. High-Performance Snapping Engine with Hysteresis (snappingEngine.js)
 * 5. Complete Raw Drawing Coordinate Preservation in Refs
 * 6. Symmetrical Dual Mouse / Pointer Drawing
 * 
 * High-frequency data is held in REFS to bypass React state updates.
 * Persistent completed CAD geometry is committed to Zustand via CommandManager.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useCadStore } from '../store/useCadStore';
import PlaneManager from '../cad/PlaneManager';
import PlaneRotationController from '../cad/PlaneRotationController';
import { PositionSmoother, SMOOTHING_PRESETS } from '../utils/smoothing';
import { GestureStateMachine, GestureStates } from '../utils/gestureStateMachine';
import { SnappingEngine } from '../utils/snappingEngine';

export function useGestureInteraction() {
    const { camera, gl } = useThree();

    // ---------------------------------------------
    // SHARED HIGH-FREQUENCY NON-REACTIVE REFS
    // ---------------------------------------------
    const cursorPosRef = useRef([0, 0, 0]);
    const snapInfoRef = useRef({ isSnapped: false, point: null, type: null });
    const drawingPointsRef = useRef([]);
    const activeDrawingRef = useRef({ active: false, type: 'FREEHAND', previewCorners: null });
    const diagnosticsRef = useRef({
        inputFps: 0,
        renderFps: 0,
        wsLatency: 0,
        packetCount: 0,
        lastPacketTime: Date.now(),
        gestureState: 'IDLE',
        activePointCount: 0
    });

    // ---------------------------------------------
    // CAD MANAGERS & ENGINE UTILITIES
    // ---------------------------------------------
    const planeManagerRef = useRef(null);
    const rotationControllerRef = useRef(null);
    const cursorSmootherRef = useRef(null);
    const drawingSmootherRef = useRef(null);
    const gestureStateMachineRef = useRef(null);
    const snappingEngineRef = useRef(null);

    if (!planeManagerRef.current) {
        planeManagerRef.current = new PlaneManager();
        rotationControllerRef.current = new PlaneRotationController(planeManagerRef.current);
        cursorSmootherRef.current = new PositionSmoother(SMOOTHING_PRESETS.CURSOR);
        drawingSmootherRef.current = new PositionSmoother(SMOOTHING_PRESETS.DRAWING);
        gestureStateMachineRef.current = new GestureStateMachine();
        snappingEngineRef.current = new SnappingEngine();
    }

    const planeManager = planeManagerRef.current;
    const rotationController = rotationControllerRef.current;
    const cursorSmoother = cursorSmootherRef.current;
    const drawingSmoother = drawingSmootherRef.current;
    const gestureStateMachine = gestureStateMachineRef.current;
    const snappingEngine = snappingEngineRef.current;

    // ---------------------------------------------
    // PREALLOCATED THREE.JS OBJECTS (ZERO ALLOCATIONS IN HOT PATH)
    // ---------------------------------------------
    const raycaster = useRef(new THREE.Raycaster()).current;
    const ndcVec = useRef(new THREE.Vector2()).current;
    const tempPlanePos = useRef(new THREE.Vector3()).current;
    const tempPointWorld = useRef(new THREE.Vector3()).current;

    // ---------------------------------------------
    // LOW-FREQUENCY ZUSTAND SELECTORS & ACTIONS
    // ---------------------------------------------
    const planeRotation = useCadStore((state) => state.planeRotation);
    const planePosition = useCadStore((state) => state.planePosition);
    const drawingMode = useCadStore((state) => state.drawingMode);
    const cadObjects = useCadStore((state) => state.cadObjects);
    const magneticLockEnabled = useCadStore((state) => state.magneticLockEnabled);
    const gridSnapEnabled = useCadStore((state) => state.gridSnapEnabled);
    const angleSnapEnabled = useCadStore((state) => state.angleSnapEnabled);
    const snapDistance = useCadStore((state) => state.snapDistance);
    const gridSize = useCadStore((state) => state.gridSize);

    const setGestureState = useCadStore((state) => state.setGestureState);
    const setPlaneLocked = useCadStore((state) => state.setPlaneLocked);
    const setPlaneRotation = useCadStore((state) => state.setPlaneRotation);
    const setSnappedInfo = useCadStore((state) => state.setSnappedInfo);
    const addCADObject = useCadStore((state) => state.addCADObject);

    // Keep active store values synced in refs for zero-overhead callback access
    const cadObjectsRef = useRef(cadObjects);
    cadObjectsRef.current = cadObjects;

    const drawingModeRef = useRef(drawingMode);
    drawingModeRef.current = drawingMode;

    const isPointerDrawingRef = useRef(false);
    const isGestureDrawingRef = useRef(false);
    const previousSwipeRef = useRef(null);

    // Sync snapping engine configuration
    useEffect(() => {
        snappingEngine.setSnapDistance(snapDistance);
        snappingEngine.setGridSize(gridSize);
        snappingEngine.setToggles({
            magnetic: magneticLockEnabled,
            grid: gridSnapEnabled,
            angle: angleSnapEnabled
        });
    }, [snapDistance, gridSize, magneticLockEnabled, gridSnapEnabled, angleSnapEnabled, snappingEngine]);

    // Sync plane manager with store
    useEffect(() => {
        planeManager.setRotation(...planeRotation);
    }, [planeRotation, planeManager]);

    useEffect(() => {
        planeManager.setPosition(...planePosition);
    }, [planePosition, planeManager]);

    // ---------------------------------------------
    // GEOMETRIC HELPER: COMPUTE RECTANGLE ON PLANE
    // ---------------------------------------------
    const computeRectangleCorners = useCallback((startPos, currentPos) => {
        if (!startPos || !currentPos) return null;

        // Convert world points to 2D coordinates on the working plane
        const startLocal = planeManager.worldToLocal(new THREE.Vector3(...startPos));
        const currentLocal = planeManager.worldToLocal(new THREE.Vector3(...currentPos));

        // 4 rectangle vertices in plane local space (X-Z plane of the plane)
        const p1Local = new THREE.Vector3(startLocal.x, startLocal.y, startLocal.z);
        const p2Local = new THREE.Vector3(currentLocal.x, startLocal.y, startLocal.z);
        const p3Local = new THREE.Vector3(currentLocal.x, startLocal.y, currentLocal.z);
        const p4Local = new THREE.Vector3(startLocal.x, startLocal.y, currentLocal.z);

        // Convert back to world space
        const p1 = planeManager.localToWorld(p1Local);
        const p2 = planeManager.localToWorld(p2Local);
        const p3 = planeManager.localToWorld(p3Local);
        const p4 = planeManager.localToWorld(p4Local);

        return [
            [p1.x, p1.y, p1.z],
            [p2.x, p2.y, p2.z],
            [p3.x, p3.y, p3.z],
            [p4.x, p4.y, p4.z]
        ];
    }, [planeManager]);

    // ---------------------------------------------
    // DRAWING LIFECYCLE MANAGEMENT (REF-BASED)
    // ---------------------------------------------
    const startDrawing = useCallback((startPoint) => {
        if (!startPoint) return;

        drawingSmoother.reset(startPoint);
        drawingPointsRef.current = [[...startPoint]];
        activeDrawingRef.current = {
            active: true,
            type: drawingModeRef.current,
            previewCorners: null
        };
        diagnosticsRef.current.activePointCount = 1;
    }, [drawingSmoother]);

    const appendDrawingPoint = useCallback((rawPoint) => {
        if (!activeDrawingRef.current.active || !rawPoint) return;

        // Smooth drawing point for stable geometry
        const smoothed = drawingSmoother.update(rawPoint);
        const finalPoint = smoothed || rawPoint;

        // Apply CAD Snapping against other objects and active plane
        const startPos = drawingPointsRef.current[0];
        const snapResult = snappingEngine.snap(
            finalPoint,
            cadObjectsRef.current,
            startPos,
            planeManager
        );

        const activePoint = snapResult.snappedPos;

        // PRESERVE EVERY COORDINATE: push to raw coordinate array
        drawingPointsRef.current.push(activePoint);
        diagnosticsRef.current.activePointCount = drawingPointsRef.current.length;

        // If drawing a rectangle, calculate coplanar preview corners
        if (activeDrawingRef.current.type === 'RECTANGLE' && startPos) {
            activeDrawingRef.current.previewCorners = computeRectangleCorners(startPos, activePoint);
        }
    }, [drawingSmoother, snappingEngine, planeManager, computeRectangleCorners]);

    const finalizeDrawing = useCallback(() => {
        if (!activeDrawingRef.current.active) return;

        const points = drawingPointsRef.current;
        const currentMode = activeDrawingRef.current.type;

        activeDrawingRef.current = { active: false, type: 'FREEHAND', previewCorners: null };
        diagnosticsRef.current.activePointCount = 0;
        drawingSmoother.reset();

        if (points.length < 2) {
            drawingPointsRef.current = [];
            return;
        }

        let finalPoints = [];

        if (currentMode === 'FREEHAND') {
            // Preserve ALL raw points collected during freehand stroke
            finalPoints = [...points];
        } else if (currentMode === 'LINE') {
            // Straight line: start and end
            finalPoints = [points[0], points[points.length - 1]];
        } else if (currentMode === 'RECTANGLE') {
            // 4 corner vertices
            const startPos = points[0];
            const endPos = points[points.length - 1];
            const corners = computeRectangleCorners(startPos, endPos);
            if (corners && corners.length === 4) {
                finalPoints = corners;
            } else {
                finalPoints = [points[0], points[points.length - 1]];
            }
        }

        // Verify minimum segment length
        const s = finalPoints[0];
        const e = finalPoints[finalPoints.length - 1];
        const dist = Math.hypot(e[0] - s[0], e[1] - s[1], e[2] - s[2]);
        if (dist < 0.01 && finalPoints.length <= 2) {
            drawingPointsRef.current = [];
            return;
        }

        // Construct completed CAD object and commit via CommandManager (Zustand + Undo Stack)
        const newCADObject = {
            id: `cad_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: currentMode,
            points: finalPoints,
            start: finalPoints[0],
            end: finalPoints[finalPoints.length - 1],
            planePosition: [...planeManager.getPosition()],
            planeRotation: [...planeManager.getRotation()],
            createdAt: Date.now()
        };

        addCADObject(newCADObject);
        drawingPointsRef.current = [];
    }, [addCADObject, computeRectangleCorners, drawingSmoother, planeManager]);

    // ---------------------------------------------
    // WEBSOCKET INTERACTION & GESTURE PROCESSING
    // ---------------------------------------------
    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8000/ws/tracking');
        let packetCount = 0;
        let lastFpsTime = Date.now();

        ws.onopen = () => {
            console.log('Connected to gesture server');
        };

        ws.onmessage = (event) => {
            const now = Date.now();
            packetCount++;

            // Calculate input FPS
            if (now - lastFpsTime >= 1000) {
                diagnosticsRef.current.inputFps = packetCount;
                packetCount = 0;
                lastFpsTime = now;
            }

            const data = JSON.parse(event.data);

            // Measure transport latency if timestamp provided
            if (data.timestamp) {
                const latency = Math.max(0, now - data.timestamp);
                diagnosticsRef.current.wsLatency = latency;
            }

            // 1. Process Gesture State Machine with Hysteresis
            const effectiveState = gestureStateMachine.update(data);
            diagnosticsRef.current.gestureState = effectiveState;

            // Discrete low-frequency store updates
            setGestureState(effectiveState);
            setPlaneLocked(data.locked);
            planeManager.setLocked(data.locked);

            // 2. PALM ROTATION
            if (effectiveState === GestureStates.ROTATING || data.state === 'OPEN_PALM') {
                if (data.swipe) {
                    const previous = previousSwipeRef.current;
                    if (previous) {
                        const dx = data.swipe.x - previous.x;
                        const dy = data.swipe.y - previous.y;
                        rotationController.update(dx, dy, camera);
                        setPlaneRotation(planeManager.getRotation());
                    }
                    previousSwipeRef.current = { x: data.swipe.x, y: data.swipe.y };
                }
            } else {
                previousSwipeRef.current = null;
            }

            // 3. CURSOR RAYCASTING & ACTIVE DRAWING (WORLD SPACE)
            if (data.cursor) {
                // Map normalized coords [0, 1] to Three.js NDC [-1, 1]
                ndcVec.set(data.cursor.x * 2 - 1, -(data.cursor.y * 2) + 1);
                raycaster.setFromCamera(ndcVec, camera);

                const normal = planeManager.getNormal();
                const planePos = tempPlanePos.set(...planeManager.getPosition());
                const denom = raycaster.ray.direction.dot(normal);

                let pointWorld = null;
                if (Math.abs(denom) > 1e-6) {
                    const t = planePos.sub(raycaster.ray.origin).dot(normal) / denom;
                    if (t >= 0) {
                        pointWorld = tempPointWorld.copy(raycaster.ray.origin)
                            .addScaledVector(raycaster.ray.direction, t);
                    }
                }

                if (pointWorld) {
                    const rawPos = [pointWorld.x, pointWorld.y, pointWorld.z];

                    // Smooth cursor position
                    const smoothedPos = cursorSmoother.update(rawPos);
                    const currentPos = smoothedPos || rawPos;

                    // Apply precision snapping
                    const startPos = activeDrawingRef.current.active ? drawingPointsRef.current[0] : null;
                    const snapResult = snappingEngine.snap(
                        currentPos,
                        cadObjectsRef.current,
                        startPos,
                        planeManager
                    );

                    const finalPos = snapResult.snappedPos;

                    // Update high-frequency non-reactive cursor position
                    cursorPosRef.current = finalPos;
                    snapInfoRef.current = snapResult;

                    // Update low-frequency snap state only if state transitioned
                    setSnappedInfo({ isSnapped: snapResult.isSnapped, point: snapResult.snappedTarget });

                    // Handle Gesture Pinch Drawing
                    const isPinching = (effectiveState === GestureStates.DRAWING || effectiveState === GestureStates.PINCH_START) && data.locked;

                    if (isPinching) {
                        if (!isGestureDrawingRef.current) {
                            isGestureDrawingRef.current = true;
                            startDrawing(finalPos);
                        } else {
                            appendDrawingPoint(finalPos);
                        }
                    } else if (isGestureDrawingRef.current) {
                        isGestureDrawingRef.current = false;
                        finalizeDrawing();
                    }
                } else if (isGestureDrawingRef.current) {
                    isGestureDrawingRef.current = false;
                    finalizeDrawing();
                }
            } else {
                cursorPosRef.current = null;
                if (isGestureDrawingRef.current) {
                    isGestureDrawingRef.current = false;
                    finalizeDrawing();
                }
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
        };
    }, [
        camera,
        raycaster,
        ndcVec,
        tempPlanePos,
        tempPointWorld,
        planeManager,
        rotationController,
        cursorSmoother,
        gestureStateMachine,
        snappingEngine,
        setGestureState,
        setPlaneLocked,
        setPlaneRotation,
        setSnappedInfo,
        startDrawing,
        appendDrawingPoint,
        finalizeDrawing
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

            ndcVec.set(x, y);
            raycaster.setFromCamera(ndcVec, camera);

            const normal = planeManager.getNormal();
            const planePos = tempPlanePos.set(...planeManager.getPosition());
            const denom = raycaster.ray.direction.dot(normal);

            if (Math.abs(denom) > 1e-6) {
                const t = planePos.sub(raycaster.ray.origin).dot(normal) / denom;
                if (t >= 0) {
                    const hit = tempPointWorld.copy(raycaster.ray.origin)
                        .addScaledVector(raycaster.ray.direction, t);
                    return [hit.x, hit.y, hit.z];
                }
            }
            return null;
        };

        const handlePointerMove = (event) => {
            const rawPos = getPlaneIntersection(event);
            if (rawPos) {
                const startPos = isPointerDrawingRef.current ? drawingPointsRef.current[0] : null;
                const snapResult = snappingEngine.snap(
                    rawPos,
                    cadObjectsRef.current,
                    startPos,
                    planeManager
                );

                const finalPos = snapResult.snappedPos;

                // Update non-reactive cursor ref
                cursorPosRef.current = finalPos;
                snapInfoRef.current = snapResult;
                setSnappedInfo({ isSnapped: snapResult.isSnapped, point: snapResult.snappedTarget });

                if (isPointerDrawingRef.current) {
                    appendDrawingPoint(finalPos);
                }
            }
        };

        const handlePointerDown = (event) => {
            if (event.button === 0) {
                const rawPos = getPlaneIntersection(event);
                if (rawPos) {
                    const snapResult = snappingEngine.snap(
                        rawPos,
                        cadObjectsRef.current,
                        null,
                        planeManager
                    );
                    const finalPos = snapResult.snappedPos;

                    isPointerDrawingRef.current = true;
                    cursorPosRef.current = finalPos;
                    startDrawing(finalPos);
                }
            }
        };

        const handlePointerUp = () => {
            if (isPointerDrawingRef.current) {
                isPointerDrawingRef.current = false;
                finalizeDrawing();
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
        raycaster,
        ndcVec,
        tempPlanePos,
        tempPointWorld,
        planeManager,
        snappingEngine,
        setSnappedInfo,
        startDrawing,
        appendDrawingPoint,
        finalizeDrawing
    ]);

    // Expose refs for direct rendering in Canvas children
    return {
        cursorPosRef,
        snapInfoRef,
        drawingPointsRef,
        activeDrawingRef,
        diagnosticsRef
    };
}