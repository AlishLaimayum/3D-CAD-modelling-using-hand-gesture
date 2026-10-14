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
 * 7. Hold-to-Perfect-Shape Recognition (shapeRecognizer.js)
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
import { recognizeShape } from '../utils/shapeRecognizer';
import { Profile2D, GEOMETRY_KIND } from '../cad/geometry/index.js';
import { faceToEuler } from '../cad/geometry/FaceEnumerator.js';



export function useGestureInteraction(zElongation, controlsRef) {
    const { camera, gl } = useThree();

    const zElongationRef = useRef(zElongation);
    useEffect(() => {
        zElongationRef.current = zElongation;
    }, [zElongation]);

    // ---------------------------------------------
    // SHARED HIGH-FREQUENCY NON-REACTIVE REFS
    // ---------------------------------------------
    const cursorPosRef = useRef([0, 0, 0]);
    const snapInfoRef = useRef({ isSnapped: false, point: null, type: null });
    const drawingPointsRef = useRef([]);
    const activeDrawingRef = useRef({ active: false, type: 'FREEHAND', previewCorners: null, holdProgress: 0, shapePerfected: false });
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
    // HOLD-TO-PERFECT-SHAPE STATE (REF-BASED)
    // ---------------------------------------------
    const SHAPE_HOLD_DURATION = 600; // ms — how long to hold pinch stationary to trigger shape recognition
    const MOTION_THRESHOLD = 0.015;  // 3D distance — below this, hand is considered "stationary"
    const shapeHoldTimerRef = useRef(null);       // setTimeout ID
    const shapeHoldStartRef = useRef(null);       // timestamp when hold started
    const lastDrawPointRef = useRef(null);        // last drawing point for motion detection
    const holdProgressRAFRef = useRef(null);      // requestAnimationFrame ID for hold progress

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

    // Keep a stable ref to controlsRef so WebSocket callback can access it
    const controlsRefRef = useRef(controlsRef);
    useEffect(() => {
        controlsRefRef.current = controlsRef;
    }, [controlsRef]);

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
    const zHoldModeEnabled = useCadStore((state) => state.zHoldModeEnabled);

    const setGestureState = useCadStore((state) => state.setGestureState);
    const setPlaneLocked = useCadStore((state) => state.setPlaneLocked);
    const setPlaneRotation = useCadStore((state) => state.setPlaneRotation);
    const gestureRotatePlane = useCadStore((state) => state.gestureRotatePlane);
    const rotateCADObject = useCadStore((state) => state.rotateCADObject);
    const selectedObjectId = useCadStore((state) => state.selectedObjectId);
    const setSnappedInfo = useCadStore((state) => state.setSnappedInfo);
    const addCADObject = useCadStore((state) => state.addCADObject);
    const selectedFace = useCadStore((state) => state.selectedFace);
    const setCurveStage = useCadStore((state) => state.setCurveStage);

    const revolveState = useCadStore((state) => state.revolveState);
    const setRevolveProfile = useCadStore((state) => state.setRevolveProfile);
    const setRevolveAxis = useCadStore((state) => state.setRevolveAxis);
    const revolveStateRef = useRef(revolveState);
    revolveStateRef.current = revolveState;

    // Dedicated state machine tracking for CURVE tool
    const curveStageRef = useRef('WAITING_FOR_START');
    const curveP0Ref = useRef(null);
    const curveP3Ref = useRef(null);
    const curveP1Ref = useRef(null);
    const curveP2Ref = useRef(null);
    const curveHandleRef = useRef(null);
    const pinchAwaitingReleaseRef = useRef(false);
    const prevPinchStateRef = useRef(false);

    const selectedObjectIdRef = useRef(selectedObjectId);
    selectedObjectIdRef.current = selectedObjectId;

    // Keep active store values synced in refs for zero-overhead callback access
    const cadObjectsRef = useRef(cadObjects);
    cadObjectsRef.current = cadObjects;

    const drawingModeRef = useRef(drawingMode);
    drawingModeRef.current = drawingMode;

    // Face plane ref — used inside pointer callbacks without closure stale-value issues
    const selectedFaceRef = useRef(selectedFace);
    selectedFaceRef.current = selectedFace;

    // Ref-tracked hold mode flag — checked in hot-path callbacks without closure issues
    const zHoldRef = useRef(zHoldModeEnabled);
    zHoldRef.current = zHoldModeEnabled;

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

        // Points are in local working plane coordinates (X-Z plane, Y ~ 0)
        const sx = startPos[0], sy = startPos[1], sz = startPos[2];
        const cx = currentPos[0], cy = currentPos[1], cz = currentPos[2];

        return [
            [sx, sy, sz],
            [cx, sy, sz],
            [cx, cy, cz],
            [sx, sy, cz]
        ];
    }, []);

    // ---------------------------------------------
    // GEOMETRIC HELPER: COMPUTE CIRCLE ON PLANE
    // Center is startPos, radius is distance to currentPos
    // ---------------------------------------------
    const CIRCLE_SEGMENTS = 64;
    const computeCirclePoints = useCallback((centerPos, edgePos) => {
        if (!centerPos || !edgePos) return null;

        const cx = centerPos[0], cy = centerPos[1], cz = centerPos[2];
        const dx = edgePos[0] - cx;
        const dz = edgePos[2] - cz;
        const radius = Math.sqrt(dx * dx + dz * dz);
        if (radius < 0.001) return null;

        const pts = [];
        for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
            const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
            pts.push([cx + radius * Math.cos(angle), cy, cz + radius * Math.sin(angle)]);
        }
        return pts;
    }, []);

    // ---------------------------------------------
    // HOLD-TO-SHAPE TIMER MANAGEMENT
    // ---------------------------------------------
    const clearShapeHoldTimer = useCallback(() => {
        if (shapeHoldTimerRef.current) {
            clearTimeout(shapeHoldTimerRef.current);
            shapeHoldTimerRef.current = null;
        }
        if (holdProgressRAFRef.current) {
            cancelAnimationFrame(holdProgressRAFRef.current);
            holdProgressRAFRef.current = null;
        }
        shapeHoldStartRef.current = null;
        if (activeDrawingRef.current.active) {
            activeDrawingRef.current.holdProgress = 0;
        }
    }, []);

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
            previewCorners: null,
            holdProgress: 0,
            shapePerfected: false
        };
        diagnosticsRef.current.activePointCount = 1;

        // Reset hold-to-shape state
        lastDrawPointRef.current = [...startPoint];
        clearShapeHoldTimer();
    }, [drawingSmoother, clearShapeHoldTimer]);

    const startHoldProgressAnimation = useCallback(() => {
        const animateProgress = () => {
            if (!shapeHoldStartRef.current || !activeDrawingRef.current.active) return;
            const elapsed = Date.now() - shapeHoldStartRef.current;
            const progress = Math.min(1.0, elapsed / SHAPE_HOLD_DURATION);
            activeDrawingRef.current.holdProgress = progress;
            if (progress < 1.0) {
                holdProgressRAFRef.current = requestAnimationFrame(animateProgress);
            }
        };
        holdProgressRAFRef.current = requestAnimationFrame(animateProgress);
    }, []);

    const tryShapeRecognition = useCallback(() => {
        if (!activeDrawingRef.current.active) return;
        if (activeDrawingRef.current.shapePerfected) return;

        const points = drawingPointsRef.current;
        if (points.length < 8) return;

        const result = recognizeShape(points);

        if (result.shape && result.perfectPoints) {
            // Replace the freehand stroke with the perfect shape
            drawingPointsRef.current = result.perfectPoints;
            diagnosticsRef.current.activePointCount = result.perfectPoints.length;
            activeDrawingRef.current.shapePerfected = true;
            activeDrawingRef.current.holdProgress = 1.0;
            activeDrawingRef.current.recognizedShape = result.shape;
            activeDrawingRef.current.confidence = result.confidence;
        } else {
            // No shape recognized — reset hold state, keep freehand
            activeDrawingRef.current.holdProgress = 0;
        }

        shapeHoldTimerRef.current = null;
        shapeHoldStartRef.current = null;
    }, []);

    const startShapeHoldTimer = useCallback(() => {
        clearShapeHoldTimer();
        shapeHoldStartRef.current = Date.now();
        startHoldProgressAnimation();

        shapeHoldTimerRef.current = setTimeout(() => {
            tryShapeRecognition();
        }, SHAPE_HOLD_DURATION);
    }, [clearShapeHoldTimer, startHoldProgressAnimation, tryShapeRecognition]);

    const appendDrawingPoint = useCallback((rawPoint) => {
        if (!activeDrawingRef.current.active || !rawPoint) return;
        // If shape was already perfected, don't append more points
        if (activeDrawingRef.current.shapePerfected) return;

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

        // If drawing a circle, calculate preview circle points (center = startPos, edge = activePoint)
        if (activeDrawingRef.current.type === 'CIRCLE' && startPos) {
            activeDrawingRef.current.previewCircle = computeCirclePoints(startPos, activePoint);
        }

        // ---------------------------------------------------------
        // MOTION DETECTION FOR HOLD-TO-PERFECT-SHAPE
        // Only for FREEHAND mode — other modes have explicit shapes
        // ---------------------------------------------------------
        if (activeDrawingRef.current.type === 'FREEHAND' && lastDrawPointRef.current) {
            const dx = activePoint[0] - lastDrawPointRef.current[0];
            const dy = activePoint[1] - lastDrawPointRef.current[1];
            const dz = activePoint[2] - lastDrawPointRef.current[2];
            const moveDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (moveDist > MOTION_THRESHOLD) {
                // Hand is moving — reset hold timer
                clearShapeHoldTimer();
                lastDrawPointRef.current = [...activePoint];
            } else if (!shapeHoldTimerRef.current && drawingPointsRef.current.length >= 8) {
                // Hand is stationary and we have enough points — start hold timer
                startShapeHoldTimer();
            }
            // If timer is already running and hand is still stationary, let it continue
        } else {
            lastDrawPointRef.current = activePoint ? [...activePoint] : null;
        }
    }, [drawingSmoother, snappingEngine, planeManager, computeRectangleCorners, computeCirclePoints, clearShapeHoldTimer, startShapeHoldTimer]);

    const finalizeDrawing = useCallback(() => {
        if (!activeDrawingRef.current.active) return;

        // Clean up hold-to-shape timer
        clearShapeHoldTimer();

        const points = drawingPointsRef.current;
        const currentMode = activeDrawingRef.current.type;
        const wasPerfected = activeDrawingRef.current.shapePerfected;
        const recognizedShape = activeDrawingRef.current.recognizedShape;

        activeDrawingRef.current = { active: false, type: 'FREEHAND', previewCorners: null, holdProgress: 0, shapePerfected: false };
        diagnosticsRef.current.activePointCount = 0;
        drawingSmoother.reset();
        lastDrawPointRef.current = null;

        if (points.length < 2) {
            drawingPointsRef.current = [];
            return;
        }

        let finalPoints = [];
        let finalType = currentMode;

        if (wasPerfected && recognizedShape) {
            // Shape was perfected by hold-to-correct — use the perfected points directly
            finalPoints = [...points];
            finalType = recognizedShape;
        } else if (currentMode === 'FREEHAND') {
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
        } else if (currentMode === 'CIRCLE') {
            // Circle: center = start point, edge = end point → generate 64 circle points
            const startPos = points[0];
            const endPos = points[points.length - 1];
            const circlePts = computeCirclePoints(startPos, endPos);
            if (circlePts && circlePts.length >= 3) {
                finalPoints = circlePts;
            } else {
                finalPoints = [points[0], points[points.length - 1]];
            }
        }

        // Verify minimum segment length
        if (!finalPoints || finalPoints.length < 2 || !finalPoints[0] || !finalPoints[finalPoints.length - 1]) {
            drawingPointsRef.current = [];
            return;
        }
        const s = finalPoints[0];
        const e = finalPoints[finalPoints.length - 1];
        const dist = Math.hypot(e[0] - s[0], e[1] - s[1], e[2] - s[2]);
        if (dist < 0.01 && finalPoints.length <= 2) {
            drawingPointsRef.current = [];
            return;
        }

        // Construct Category 1: 2D Geometry profile
        const profile = new Profile2D({
            points: finalPoints,
            type: finalType,
            isClosed: finalType === 'RECTANGLE'
        });

        // Use face plane when a face is selected, otherwise use working plane
        const face = selectedFaceRef.current;
        const newCADObject = {
            id: `cad_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: finalType,
            kind: GEOMETRY_KIND.SKETCH_2D, // Category 1: 2D Geometry initially
            points: finalPoints,
            start: finalPoints[0],
            end: finalPoints[finalPoints.length - 1],
            profile: profile,
            solidMesh: null,
            extrudeHeight: 0,
            isClosed: finalType === 'RECTANGLE' || finalType === 'CIRCLE',
            planePosition: face ? [...face.position] : [...planeManager.getPosition()],
            planeRotation: face ? faceToEuler(face) : [...planeManager.getRotation()],
            createdAt: Date.now()
        };

        addCADObject(newCADObject);
        drawingPointsRef.current = [];
    }, [addCADObject, computeRectangleCorners, computeCirclePoints, clearShapeHoldTimer, drawingSmoother, planeManager]);

    // ---------------------------------------------
    // CURVE DRAWING TOOL: CUBIC BEZIER COMPUTATION
    // Fixed endpoints P0 and P3; hand position H controls bend.
    // Derived such that midpoint C(0.5) passes directly through H:
    // P1 = A + 4/3(H - M), P2 = B + 4/3(H - M)
    // ---------------------------------------------
    const computeCubicBezierPoints = useCallback((p0, p3, handPos) => {
        if (!p0 || !p3 || !handPos) return null;

        // Chord midpoint M
        const mx = (p0[0] + p3[0]) / 2;
        const my = (p0[1] + p3[1]) / 2;
        const mz = (p0[2] + p3[2]) / 2;

        // Chord third points: A = P0 + 1/3 (P3 - P0), B = P0 + 2/3 (P3 - P0)
        const ax = p0[0] + (p3[0] - p0[0]) / 3;
        const ay = p0[1] + (p3[1] - p0[1]) / 3;
        const az = p0[2] + (p3[2] - p0[2]) / 3;

        const bx = p0[0] + (p3[0] - p0[0]) * (2 / 3);
        const by = p0[1] + (p3[1] - p0[1]) * (2 / 3);
        const bz = p0[2] + (p3[2] - p0[2]) * (2 / 3);

        // Displacement from chord
        const dx = handPos[0] - mx;
        const dy = handPos[1] - my;
        const dz = handPos[2] - mz;

        // Control points
        const p1 = [ax + (4 / 3) * dx, ay + (4 / 3) * dy, az + (4 / 3) * dz];
        const p2 = [bx + (4 / 3) * dx, by + (4 / 3) * dy, bz + (4 / 3) * dz];

        const curve = new THREE.CubicBezierCurve3(
            new THREE.Vector3(p0[0], p0[1], p0[2]),
            new THREE.Vector3(p1[0], p1[1], p1[2]),
            new THREE.Vector3(p2[0], p2[1], p2[2]),
            new THREE.Vector3(p3[0], p3[1], p3[2])
        );

        const sampled = curve.getPoints(50).map((v) => [v.x, v.y, v.z]);
        return { p1, p2, sampled };
    }, []);

    const finalizeCurve = useCallback((sampledPoints, controlPoints) => {
        if (!sampledPoints || sampledPoints.length < 2) return;

        const profile = new Profile2D({
            points: sampledPoints,
            type: 'CURVE',
            isClosed: false
        });

        const face = selectedFaceRef.current;
        const newCADObject = {
            id: `cad_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: 'CURVE',
            kind: GEOMETRY_KIND.SKETCH_2D,
            points: sampledPoints,
            start: sampledPoints[0],
            end: sampledPoints[sampledPoints.length - 1],
            controlPoints: controlPoints,
            profile: profile,
            solidMesh: null,
            extrudeHeight: 0,
            isClosed: false,
            planePosition: face ? [...face.position] : [...planeManager.getPosition()],
            planeRotation: face ? faceToEuler(face) : [...planeManager.getRotation()],
            createdAt: Date.now()
        };

        addCADObject(newCADObject);

        // Reset to WAITING_FOR_START for seamless next curve
        curveStageRef.current = 'WAITING_FOR_START';
        curveP0Ref.current = null;
        curveP3Ref.current = null;
        curveP1Ref.current = null;
        curveP2Ref.current = null;
        curveHandleRef.current = null;
        setCurveStage('WAITING_FOR_START');

        activeDrawingRef.current = {
            active: false,
            type: 'CURVE',
            curveStage: 'WAITING_FOR_START',
            p0: null,
            p3: null,
            p1: null,
            p2: null,
            handle: null,
            previewPoints: null
        };
        drawingPointsRef.current = [];
    }, [addCADObject, planeManager, setCurveStage]);

    const resetCurveState = useCallback(() => {
        curveStageRef.current = 'WAITING_FOR_START';
        curveP0Ref.current = null;
        curveP3Ref.current = null;
        curveP1Ref.current = null;
        curveP2Ref.current = null;
        curveHandleRef.current = null;
        pinchAwaitingReleaseRef.current = false;
        prevPinchStateRef.current = false;
        setCurveStage('WAITING_FOR_START');

        if (activeDrawingRef.current.type === 'CURVE') {
            activeDrawingRef.current = {
                active: false,
                type: 'CURVE',
                curveStage: 'WAITING_FOR_START',
                p0: null,
                p3: null,
                p1: null,
                p2: null,
                handle: null,
                previewPoints: null
            };
            drawingPointsRef.current = [];
        }
    }, [setCurveStage]);

    // Reset curve state on tool switch
    useEffect(() => {
        resetCurveState();
    }, [drawingMode, resetCurveState]);

    // Handle Escape key cancellation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                resetCurveState();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [resetCurveState]);

    /**
     * Exact 4-State Interaction Sequence for Gesture & Pointer:
     * State 1: WAITING_FOR_START (Pinch 1 sets P0)
     * State 2: WAITING_FOR_END (Pinch 2 sets P3)
     * State 3: SHAPING_CURVE (Hand moves to bend curve; endpoints remain fixed)
     * State 4: FINALIZE (Pinch 3 commits persistent curve)
     */
    const handleCurveStep = useCallback((isPinching, currentPos) => {
        if (!currentPos) return;

        const isPinchDown = isPinching && !prevPinchStateRef.current;
        const isPinchUp = !isPinching && prevPinchStateRef.current;
        prevPinchStateRef.current = isPinching;

        if (isPinchUp) {
            // Require pinch release before accepting next stage
            pinchAwaitingReleaseRef.current = false;
        }

        const stage = curveStageRef.current;

        if (stage === 'WAITING_FOR_START') {
            if (isPinchDown && !pinchAwaitingReleaseRef.current) {
                // State 1 -> State 2: Save start point P0
                curveP0Ref.current = [...currentPos];
                curveStageRef.current = 'WAITING_FOR_END';
                pinchAwaitingReleaseRef.current = true;
                setCurveStage('WAITING_FOR_END');

                activeDrawingRef.current = {
                    active: true,
                    type: 'CURVE',
                    curveStage: 'WAITING_FOR_END',
                    p0: [...currentPos],
                    p3: null,
                    p1: null,
                    p2: null,
                    handle: null,
                    previewPoints: null
                };
                drawingPointsRef.current = [[...currentPos]];
            }
        } else if (stage === 'WAITING_FOR_END') {
            const p0 = curveP0Ref.current;
            if (!p0) return;

            // Track hand cursor, show line from start point to current cursor
            drawingPointsRef.current = [p0, currentPos];

            if (isPinchDown && !pinchAwaitingReleaseRef.current) {
                const dist = Math.hypot(currentPos[0] - p0[0], currentPos[1] - p0[1], currentPos[2] - p0[2]);
                if (dist > 0.05) {
                    // State 2 -> State 3: Save endpoint P3
                    curveP3Ref.current = [...currentPos];
                    curveStageRef.current = 'SHAPING_CURVE';
                    pinchAwaitingReleaseRef.current = true;
                    setCurveStage('SHAPING_CURVE');

                    const mid = [
                        (p0[0] + currentPos[0]) / 2,
                        0,
                        (p0[2] + currentPos[2]) / 2
                    ];
                    const res = computeCubicBezierPoints(p0, currentPos, mid);
                    if (res) {
                        curveP1Ref.current = res.p1;
                        curveP2Ref.current = res.p2;
                        curveHandleRef.current = mid;

                        activeDrawingRef.current = {
                            active: true,
                            type: 'CURVE',
                            curveStage: 'SHAPING_CURVE',
                            p0: p0,
                            p3: [...currentPos],
                            p1: res.p1,
                            p2: res.p2,
                            handle: mid,
                            previewPoints: res.sampled
                        };
                    }
                }
            }
        } else if (stage === 'SHAPING_CURVE') {
            const p0 = curveP0Ref.current;
            const p3 = curveP3Ref.current;
            if (!p0 || !p3) return;

            // Moving hand shapes curve continuously; endpoints remain fixed
            // Project control position onto active work plane (y = 0 in local space)
            const handPos = [currentPos[0], 0, currentPos[2]];
            curveHandleRef.current = handPos;

            const res = computeCubicBezierPoints(p0, p3, handPos);
            if (res) {
                curveP1Ref.current = res.p1;
                curveP2Ref.current = res.p2;

                activeDrawingRef.current = {
                    active: true,
                    type: 'CURVE',
                    curveStage: 'SHAPING_CURVE',
                    p0: p0,
                    p3: p3,
                    p1: res.p1,
                    p2: res.p2,
                    handle: handPos,
                    previewPoints: res.sampled
                };

                if (isPinchDown && !pinchAwaitingReleaseRef.current) {
                    // State 3 -> State 4: FINALIZE
                    pinchAwaitingReleaseRef.current = true;
                    setCurveStage('FINALIZE');
                    finalizeCurve(res.sampled, [p0, res.p1, res.p2, p3]);
                }
            }
        }
    }, [computeCubicBezierPoints, finalizeCurve, setCurveStage]);

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

            // 2. GESTURE PLANE ROTATION (OPEN_PALM / ROTATING)
            // Rotates the plane via PlaneRotationController, then calls gestureRotatePlane
            // which updates BOTH the store planeRotation AND every cadObject's frozen
            // planeRotation — so geometry rigidly follows the plane without being
            // inside the plane group (which would break XY/YZ/XZ preset switching).
            if (effectiveState === GestureStates.ROTATING || data.state === 'OPEN_PALM') {
                if (data.swipe) {
                    const previous = previousSwipeRef.current;
                    if (previous) {
                        const dx = data.swipe.x - previous.x;
                        const dy = data.swipe.y - previous.y;

                        let dangle = 0;
                        if (data.swipe.angle !== undefined && previous.angle !== undefined) {
                            dangle = data.swipe.angle - previous.angle;
                            if (dangle > Math.PI)  dangle -= 2 * Math.PI;
                            if (dangle < -Math.PI) dangle += 2 * Math.PI;
                        }

                        if (selectedObjectIdRef.current) {
                            // Model / Object rotation: rotates the selected object around its deliberate center pivot
                            const deltaQ = rotationController.computeDeltaQuaternion(dx, dy, camera, data.state, dangle);
                            if (deltaQ) {
                                rotateCADObject(selectedObjectIdRef.current, deltaQ);
                            }
                        } else {
                            // Work-Plane rotation: rotates ONLY the active working plane
                            rotationController.update(dx, dy, camera, data.state, dangle);
                            gestureRotatePlane(planeManager.getRotation());
                        }
                        cursorSmoother.reset();
                        drawingSmoother.reset();
                    } else {
                        rotationController.start();
                    }
                    previousSwipeRef.current = {
                        x: data.swipe.x,
                        y: data.swipe.y,
                        angle: data.swipe.angle
                    };
                }
            } else {
                if (previousSwipeRef.current) {
                    rotationController.stop();
                    previousSwipeRef.current = null;
                }
            }

            // 3. CURSOR RAYCASTING & ACTIVE DRAWING (PLANE LOCAL SPACE)
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
                    // Convert world intersection point into working plane local coordinates
                    const localPt = planeManager.worldToLocal(pointWorld);
                    const rawPos = [localPt.x, localPt.y, localPt.z];

                    // Smooth cursor position in local plane coordinates
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

                    // Handle Gesture Pinch Drawing vs. Z-Elongation vs. Curve
                    const rawPinch = data.state === 'PINCH' || (data.pinch_ratio !== undefined && data.pinch_ratio !== null && data.pinch_ratio < 0.48);
                    const isPinching = zHoldRef.current
                        ? (rawPinch || effectiveState === GestureStates.DRAWING || effectiveState === GestureStates.PINCH_START)
                        : ((effectiveState === GestureStates.DRAWING || effectiveState === GestureStates.PINCH_START || rawPinch));

                    if (zHoldRef.current) {
                        // Drawing disabled in Hold mode — route pinch gestures directly to Z-Elongation
                        if (isGestureDrawingRef.current) {
                            isGestureDrawingRef.current = false;
                            finalizeDrawing();
                        }
                        const ndc = { x: data.cursor.x * 2 - 1, y: -(data.cursor.y * 2) + 1 };
                        zElongationRef.current?.handleGesturePinchUpdate?.(isPinching, ndc);
                    } else if (revolveStateRef.current?.active) {
                        // Revolve mode: gesture pinch selects profile or axis
                        if (isPinching && !pinchAwaitingReleaseRef.current) {
                            pinchAwaitingReleaseRef.current = true;
                            const rState = revolveStateRef.current;
                            let closestObj = null;
                            let minDist = 1.5; // cm selection radius
                            for (const obj of (cadObjectsRef.current || [])) {
                                const pts = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
                                for (const p of pts) {
                                    const d = Math.hypot(p[0] - finalPos[0], p[1] - finalPos[1], p[2] - finalPos[2]);
                                    if (d < minDist) {
                                        minDist = d;
                                        closestObj = obj;
                                    }
                                }
                            }
                            if (closestObj) {
                                if (rState.step === 'SELECT_AXIS' && closestObj.type === 'LINE') {
                                    setRevolveAxis({
                                        type: 'LINE',
                                        lineId: closestObj.id,
                                        points: closestObj.points || [closestObj.start, closestObj.end]
                                    });
                                } else {
                                    setRevolveProfile(closestObj.id);
                                }
                            }
                        } else if (!isPinching) {
                            pinchAwaitingReleaseRef.current = false;
                        }
                    } else if (drawingModeRef.current === 'CURVE') {
                        // Gesture-Controlled 4-Stage Curved-Line Tool
                        handleCurveStep(isPinching, finalPos);
                    } else if (isPinching) {
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
                if (drawingModeRef.current === 'CURVE') {
                    prevPinchStateRef.current = false;
                    pinchAwaitingReleaseRef.current = false;
                }
                if (zHoldRef.current) {
                    zElongationRef.current?.handleGesturePinchUpdate?.(false, null);
                }
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
        drawingSmoother,
        gestureStateMachine,
        snappingEngine,
        setGestureState,
        setPlaneLocked,
        setPlaneRotation,
        gestureRotatePlane,
        setSnappedInfo,
        startDrawing,
        appendDrawingPoint,
        finalizeDrawing,
        handleCurveStep
    ]);

    // ---------------------------------------------
    // DUAL MOUSE & POINTER INTERACTION (DRAW & HOVER)
    // ---------------------------------------------
    useEffect(() => {
        const domElement = gl.domElement;
        if (!domElement) return;

        /**
         * Compute the ray-plane intersection for the current pointer event.
         * If a face is selected, intersects with that face's plane and returns
         * coordinates in the face's local frame (tangent / bitangent / normal).
         * Otherwise falls back to the working plane.
         */
        const getPlaneIntersection = (event) => {
            const rect = domElement.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            ndcVec.set(x, y);
            raycaster.setFromCamera(ndcVec, camera);

            const face = selectedFaceRef.current;

            if (face) {
                // --- Face-attached plane intersection ---
                const normal   = new THREE.Vector3(...face.normal);
                const planePos = new THREE.Vector3(...face.position);
                const denom    = raycaster.ray.direction.dot(normal);
                if (Math.abs(denom) > 1e-6) {
                    const t = planePos.clone().sub(raycaster.ray.origin).dot(normal) / denom;
                    if (t >= 0) {
                        const hit = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, t);
                        // Express hit in face-local coords (tangent, bitangent, normal)
                        const localVec = hit.clone().sub(planePos);
                        const tang = new THREE.Vector3(...face.tangent);
                        const btan = new THREE.Vector3(...face.bitangent);
                        const u = localVec.dot(tang);
                        const v = localVec.dot(btan);
                        // Return as [u, 0, v] so existing 2D drawing tools work unchanged
                        return [u, 0, v];
                    }
                }
                return null;
            }

            // --- Working plane intersection (original behaviour) ---
            const normal = planeManager.getNormal();
            const planePos = tempPlanePos.set(...planeManager.getPosition());
            const denom = raycaster.ray.direction.dot(normal);

            if (Math.abs(denom) > 1e-6) {
                const t = planePos.sub(raycaster.ray.origin).dot(normal) / denom;
                if (t >= 0) {
                    const hit = tempPointWorld.copy(raycaster.ray.origin)
                        .addScaledVector(raycaster.ray.direction, t);
                    const localPt = planeManager.worldToLocal(hit);
                    return [localPt.x, localPt.y, localPt.z];
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

                if (drawingModeRef.current === 'CURVE') {
                    handleCurveStep(false, finalPos);
                } else if (isPointerDrawingRef.current) {
                    appendDrawingPoint(finalPos);
                }
            }
        };

        const handlePointerDown = (event) => {
            // Drawing is disabled in Z-Hold mode and Revolve mode — direct clicks/pinches belong to object interaction
            if (zHoldRef.current || revolveStateRef.current?.active) return;
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

                    cursorPosRef.current = finalPos;
                    if (drawingModeRef.current === 'CURVE') {
                        handleCurveStep(true, finalPos);
                    } else {
                        isPointerDrawingRef.current = true;
                        startDrawing(finalPos);
                    }
                }
            }
        };

        const handlePointerUp = () => {
            if (drawingModeRef.current === 'CURVE') {
                handleCurveStep(false, cursorPosRef.current);
            } else if (isPointerDrawingRef.current) {
                isPointerDrawingRef.current = false;
                if (!zHoldRef.current) {
                    finalizeDrawing();
                } else {
                    // Hold mode activated mid-draw — discard the in-progress stroke
                    activeDrawingRef.current = { active: false, type: 'FREEHAND', previewCorners: null, holdProgress: 0, shapePerfected: false };
                    drawingPointsRef.current = [];
                    clearShapeHoldTimer();
                }
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
        finalizeDrawing,
        clearShapeHoldTimer,
        handleCurveStep
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