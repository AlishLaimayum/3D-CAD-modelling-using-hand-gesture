/**
 * useCadStore.js - Low-Frequency Persistent CAD Application State
 * 
 * High-frequency tracking data (live cursor, drawing stroke points, per-frame snap vectors)
 * is maintained in non-reactive refs and rendered directly through Three.js / R3F useFrame.
 * 
 * Zustand maintains only persistent, low-frequency state:
 * - Completed CAD geometry objects (Freehand curves, Lines, Rectangles)
 * - Active plane parameters (rotation, position, presets)
 * - Snapping & grid preferences
 * - Discrete gesture state changes
 * - Undo / Redo command history
 */

import { create } from 'zustand';
import { cadCommandManager } from '../cad/CommandManager';
import { 
    CreateCADObjectCommand, 
    ClearCADObjectsCommand,
    UpdateCADObjectCommand,
    DeleteCADObjectCommand
} from '../cad/commands/CADCommands';
import { 
    GEOMETRY_KIND, 
    Profile2D, 
    ExtrusionEngine, 
    RevolveEngine,
    SolidMesh,
    ProfileDetector
} from '../cad/geometry/index.js';
import { faceToEuler } from '../cad/geometry/FaceEnumerator.js';
import { 
    resizeLineInCm, 
    resizeRectangleInCm, 
    resizeCircleInCm, 
    resizeFreehandInCm 
} from '../utils/dimensionUtils.js';
import { computeRotatedObjectTransform } from '../utils/transformUtils.js';

export const useCadStore = create((set, get) => {
    // Synchronize CommandManager stack availability with store
    cadCommandManager.onStackChange = ({ canUndo, canRedo }) => {
        set({ canUndo, canRedo });
    };

    return {
        // ---------------------------------------------
        // UNITS & STANDARDS (CENTIMETERS)
        // ---------------------------------------------
        unit: 'cm',
        unitScale: 1.0, // 1 Three.js world unit = 1.0 cm
        defaultExtrudeHeight: 2.0, // 2.0 cm default
        setDefaultExtrudeHeight: (h) => set({ defaultExtrudeHeight: Math.max(0.1, Number(h)) }),

        // ---------------------------------------------
        // PERSISTENT CAD OBJECTS & SELECTION
        // ---------------------------------------------
        cadObjects: [],
        selectedObjectId: null,
        hoveredObjectId: null,
        drawingMode: 'SELECT', // 'SELECT' | 'FREEHAND' | 'LINE' | 'RECTANGLE' | 'CIRCLE' | 'CURVE'
        curveStage: 'WAITING_FOR_START', // 'WAITING_FOR_START' | 'WAITING_FOR_END' | 'SHAPING_CURVE' | 'FINALIZE'

        // CAD Revolve (Lathe) Modeling Workflow State
        revolveState: {
            active: false,
            step: 'SELECT_PROFILE', // 'SELECT_PROFILE' | 'SELECT_AXIS' | 'ADJUST_SETTINGS'
            selectedProfileId: null,
            selectedAxis: 'PROFILE_LEFT', // preset string or { a0, p0, p1, dir, label }
            angleDeg: 360,
            isSurface: false,
            reversed: false,
            previewEnabled: true,
            errorMessage: null
        },

        // Auto-detected logical sketch profiles (computed by ProfileDetector)
        detectedProfiles: [],

        // Face / Surface selection — null when no face is selected
        // Shape: { objectId, faceLabel, normal: [x,y,z], position: [x,y,z], tangent: [x,y,z], bitangent: [x,y,z] }
        selectedFace: null,
        savedPlaneState: null,
        
        // Backwards-compatible getter for legacy lines
        get lines() {
            return get().cadObjects;
        },

        // ---------------------------------------------
        // WORKING PLANE STATE
        // ---------------------------------------------
        planeLocked: false,
        activePreset: 'XY',
        planeRotation: [Math.PI / 2, 0, 0],
        planePosition: [0, 0, 0],
        activePlaneNormal: [0, 0, 1],
        activePlaneOrigin: [0, 0, 0],

        // ---------------------------------------------
        // GESTURE & TRACKING STATE (LOW-FREQUENCY)
        // ---------------------------------------------
        gestureState: 'IDLE',

        // ---------------------------------------------
        // SNAPPING & PRECISION CONFIGURATION
        // ---------------------------------------------
        magneticLockEnabled: true,
        gridSnapEnabled: false,
        angleSnapEnabled: false,
        snapDistance: 0.25,
        gridSize: 0.5,
        isSnapped: false,
        snappedPoint: null,

        // ---------------------------------------------
        // UNDO / REDO & DIAGNOSTICS
        // ---------------------------------------------
        canUndo: false,
        canRedo: false,
        diagnosticsEnabled: false,

        // ---------------------------------------------
        // Z-AXIS ELONGATION HOLD MODE
        // ---------------------------------------------
        zHoldModeEnabled: false,

        // =============================================
        // ACTIONS & SETTERS (WITH DEDUPLICATION)
        // =============================================

        setDrawingMode: (mode) => {
            if (get().drawingMode !== mode) {
                const updates = { 
                    drawingMode: mode,
                    curveStage: 'WAITING_FOR_START'
                };
                // Clear object selection when switching to a drawing tool UNLESS a face is selected
                if (mode !== 'SELECT' && !get().selectedFace) {
                    updates.selectedObjectId = null;
                }
                set(updates);
            }
        },

        setCurveStage: (stage) => set({ curveStage: stage }),

        selectObject: (id) => {
            if (get().selectedObjectId !== id) {
                set({ selectedObjectId: id, drawingMode: 'SELECT' });
            }
        },

        deselectObject: () => {
            const saved = get().savedPlaneState;
            if (saved) {
                set({
                    selectedObjectId: null,
                    selectedFace: null,
                    savedPlaneState: null,
                    planePosition: saved.planePosition,
                    planeRotation: saved.planeRotation,
                    activePreset: saved.activePreset,
                });
            } else {
                set({ selectedObjectId: null, selectedFace: null });
            }
        },

        setSelectedFace: (face) => {
            if (!face) {
                get().clearSelectedFace();
                return;
            }
            const currentSaved = get().savedPlaneState || {
                planePosition: [...get().planePosition],
                planeRotation: [...get().planeRotation],
                activePreset: get().activePreset,
            };

            const faceEuler = faceToEuler(face);

            set({
                selectedFace: face,
                savedPlaneState: currentSaved,
                planePosition: [...face.position],
                planeRotation: faceEuler,
                activePreset: 'CUSTOM',
            });
        },

        clearSelectedFace: () => {
            const saved = get().savedPlaneState;
            if (saved) {
                set({
                    selectedFace: null,
                    savedPlaneState: null,
                    planePosition: saved.planePosition,
                    planeRotation: saved.planeRotation,
                    activePreset: saved.activePreset,
                });
            } else {
                set({ selectedFace: null });
            }
        },

        setHoveredObjectId: (id) => {
            if (get().hoveredObjectId !== id) {
                set({ hoveredObjectId: id });
            }
        },

        deleteSelectedObject: () => {
            const id = get().selectedObjectId;
            if (!id) return;
            const obj = get().cadObjects.find((o) => o.id === id);
            if (!obj) return;
            const storeApi = {
                internalAddObject: get().internalAddObject,
                internalRemoveObject: get().internalRemoveObject,
                internalSetObjects: get().internalSetObjects
            };
            const command = new DeleteCADObjectCommand(obj, storeApi);
            cadCommandManager.execute(command);
            set({ selectedObjectId: null, hoveredObjectId: null });
        },

        setGestureState: (state) => {
            if (get().gestureState !== state) {
                set({ gestureState: state });
            }
        },

        setPlaneLocked: (locked) => {
            if (get().planeLocked !== locked) {
                set({ planeLocked: locked });
            }
        },

        setPlaneRotation: (rotation) => set({ planeRotation: rotation }),
        setPlanePosition: (position) => set({ planePosition: position }),

        // Updates the active working plane ONLY. Existing CAD objects maintain
        // their own invariant world positions and orientations.
        gestureRotatePlane: (rotation) => set({ planeRotation: rotation }),

        /**
         * Deliberate Model/Object Rotation around its center pivot point.
         * Affects ONLY the specified/selected CAD object.
         */
        rotateCADObject: (objectId, deltaRotation, customPivot = null) => {
            const id = objectId || get().selectedObjectId;
            if (!id) return;
            const obj = get().cadObjects.find((o) => o.id === id);
            if (!obj) return;

            const transform = computeRotatedObjectTransform(obj, deltaRotation, customPivot);
            if (transform) {
                get().updateCADObject(id, transform);
            }
        },

        toggleZHoldMode: () => set((state) => {
            const next = !state.zHoldModeEnabled;
            return {
                zHoldModeEnabled: next,
                hoveredObjectId: null,
                ...(next ? { drawingMode: 'SELECT' } : {})
            };
        }),

        cameraTargetPosition: null,
        cameraTargetUp: null,

        setCameraTargetPosition: (pos) => set({ cameraTargetPosition: pos }),
        setCameraTargetUp: (up) => set({ cameraTargetUp: up }),

        setPresetPlane: (preset) => set((state) => {
            let rot = [0, 0, 0];
            let camPos = [6, 6, 6];
            let camUp = [0, 1, 0];
            let normal = [0, 0, 1];

            const px = state.planePosition[0];
            const py = state.planePosition[1];
            const pz = state.planePosition[2];

            if (preset === 'XY') {
                // XY plane: normal = +Z [0, 0, 1]
                // The plane is facing the viewer directly like a sheet of paper.
                // X (Red) is horizontal, Y (Green) is vertical, Z (Blue) points towards camera.
                rot = [Math.PI / 2, 0, 0];
                normal = [0, 0, 1];
                camPos = [px, py, pz + 9];
                camUp = [0, 1, 0];
            } else if (preset === 'YZ') {
                // YZ plane: normal = +X [1, 0, 0]
                // The plane is facing the viewer directly like a sheet of paper.
                // Z (Blue) is horizontal, Y (Green) is vertical, X (Red) points towards camera.
                rot = [0, 0, -Math.PI / 2];
                normal = [1, 0, 0];
                camPos = [px + 9, py, pz];
                camUp = [0, 1, 0];
            } else if (preset === 'XZ') {
                // XZ plane: normal = +Y [0, 1, 0]
                // The plane is facing the viewer directly like a sheet of paper.
                // X (Red) is horizontal, Z (Blue) is vertical, Y (Green) points towards camera.
                rot = [0, 0, 0];
                normal = [0, 1, 0];
                camPos = [px, py + 9, pz + 0.0001];
                camUp = [0, 0, -1];
            } else if (preset === 'ISO') {
                // ISO is a VIEW-ONLY change — move the camera only.
                // Do NOT touch planeRotation or activePlaneNormal; geometry must
                // stay on the plane it was drawn on (XY, YZ, or XZ).
                camPos = [px + 7, py + 7, pz + 7];
                camUp = [0, 1, 0];
                return {
                    activePreset: 'ISO',
                    cameraTargetPosition: camPos,
                    cameraTargetUp: camUp
                    // planeRotation and activePlaneNormal intentionally unchanged
                };
            }

            return { 
                planeRotation: rot, 
                activePreset: preset,
                activePlaneNormal: normal,
                cameraTargetPosition: camPos,
                cameraTargetUp: camUp
            };
        }),

        startDrawingXYWithZOffset: (offset = 2) => set((state) => {
            const zVal = (typeof offset === 'number' && !isNaN(offset))
                ? offset
                : (state.planePosition[2] !== 0 ? state.planePosition[2] : 2);

            const px = state.planePosition[0];
            const py = state.planePosition[1];
            const pz = zVal;

            const rot = [Math.PI / 2, 0, 0];
            const normal = [0, 0, 1];
            const camPos = [px, py, pz + 9];
            const camUp = [0, 1, 0];

            return {
                activePreset: 'XY',
                planeRotation: rot,
                planePosition: [px, py, pz],
                activePlaneNormal: normal,
                cameraTargetPosition: camPos,
                cameraTargetUp: camUp,
                zHoldModeEnabled: false,
                drawingMode: state.drawingMode === 'HOLD' ? 'FREEHAND' : state.drawingMode
            };
        }),

        setPlaneOffset: (axis, value) => set((state) => {
            const current = [...state.planePosition];
            if (axis === 'X') current[0] = value;
            else if (axis === 'Y') current[1] = value;
            else if (axis === 'Z') current[2] = value;
            else if (typeof axis === 'number') current[1] = axis; // backwards compatibility

            const updates = { planePosition: current };
            if (state.activePreset === 'XY' && axis === 'Z') {
                updates.cameraTargetPosition = [current[0], current[1], current[2] + 9];
            }
            return updates;
        }),

        toggleMagneticLock: () => set((state) => ({ magneticLockEnabled: !state.magneticLockEnabled })),
        setMagneticLockEnabled: (enabled) => set({ magneticLockEnabled: enabled }),
        
        toggleGridSnap: () => set((state) => ({ gridSnapEnabled: !state.gridSnapEnabled })),
        toggleAngleSnap: () => set((state) => ({ angleSnapEnabled: !state.angleSnapEnabled })),

        setSnapDistance: (dist) => set({ snapDistance: dist }),
        setGridSize: (size) => set({ gridSize: size }),

        setSnappedInfo: (info) => {
            const current = get();
            const sameState = current.isSnapped === info.isSnapped;
            const samePoint = (!current.snappedPoint && !info.point) ||
                (current.snappedPoint && info.point &&
                 current.snappedPoint[0] === info.point[0] &&
                 current.snappedPoint[1] === info.point[1] &&
                 current.snappedPoint[2] === info.point[2]);

            if (!sameState || !samePoint) {
                set({ isSnapped: info.isSnapped, snappedPoint: info.point || null });
            }
        },

        toggleDiagnostics: () => set((state) => ({ diagnosticsEnabled: !state.diagnosticsEnabled })),

        // ---------------------------------------------
        // CAD OBJECT COMMANDS (UNDO / REDO INTEGRATED)
        // ---------------------------------------------

        /**
         * Add a new completed CAD object with undo support
         */
        addCADObject: (cadObject) => {
            const storeApi = {
                internalAddObject: get().internalAddObject,
                internalRemoveObject: get().internalRemoveObject,
                internalSetObjects: get().internalSetObjects
            };
            const command = new CreateCADObjectCommand(cadObject, storeApi);
            cadCommandManager.execute(command);
        },

        undo: () => {
            cadCommandManager.undo();
        },

        redo: () => {
            cadCommandManager.redo();
        },

        clearCADObjects: () => {
            const objects = get().cadObjects;
            if (objects.length === 0) return;
            const storeApi = {
                internalAddObject: get().internalAddObject,
                internalRemoveObject: get().internalRemoveObject,
                internalSetObjects: get().internalSetObjects
            };
            const command = new ClearCADObjectsCommand(objects, storeApi);
            cadCommandManager.execute(command);
        },

        setCADObjects: (objects) => {
            cadCommandManager.clear();
            set({ cadObjects: objects });
        },

        // Internal methods used by Command implementations
        internalAddObject: (obj) => set((state) => {
            const normalized = { ...obj };
            if (!normalized.profile && normalized.points) {
                normalized.profile = new Profile2D({
                    points: normalized.points,
                    type: normalized.type || 'FREEHAND',
                    isClosed: normalized.type === 'RECTANGLE' || normalized.type === 'CIRCLE'
                });
            }
            if (normalized.extrudeHeight > 0.01 && !normalized.solidMesh) {
                normalized.solidMesh = ExtrusionEngine.extrude(normalized.profile, normalized.extrudeHeight);
                normalized.kind = normalized.solidMesh.kind;
            } else if (!normalized.kind) {
                normalized.kind = GEOMETRY_KIND.SKETCH_2D;
            }
            return { cadObjects: [...state.cadObjects, normalized] };
        }),

        internalRemoveObject: (id) => set((state) => ({ 
            cadObjects: state.cadObjects.filter((o) => o.id !== id),
            selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId
        })),

        internalSetObjects: (objects) => set({
            cadObjects: objects.map((obj) => {
                const norm = { ...obj };
                if (!norm.profile && norm.points) {
                    norm.profile = new Profile2D({
                        points: norm.points,
                        type: norm.type || 'FREEHAND',
                        isClosed: norm.type === 'RECTANGLE' || norm.type === 'CIRCLE'
                    });
                }
                const h = Math.max(0, norm.extrudeHeight ?? ((norm.scaleZ && norm.scaleZ > 0.05 && norm.scaleZ !== 1) ? norm.scaleZ : 0));
                if (h > 0.01) {
                    norm.extrudeHeight = h;
                    norm.solidMesh = ExtrusionEngine.extrude(norm.profile, h);
                    norm.kind = norm.solidMesh.kind;
                } else {
                    norm.kind = GEOMETRY_KIND.SKETCH_2D;
                    norm.solidMesh = null;
                }
                return norm;
            })
        }),

        internalUpdateObject: (id, props) => set((state) => ({
            cadObjects: state.cadObjects.map((o) => {
                if (o.id !== id) return o;
                const updated = { ...o, ...props };

                // Rebuild Profile2D if points were updated without a profile
                if (props.points && !props.profile) {
                    updated.profile = new Profile2D({
                        points: props.points,
                        type: updated.type,
                        isClosed: updated.type === 'RECTANGLE' || updated.type === 'CIRCLE'
                    });
                }

                // If extrudeHeight or points changed, ensure 3D solid mesh is updated accurately
                const heightSpecified = props.extrudeHeight !== undefined;
                const pointsChanged = props.points !== undefined;
                const currentHeight = heightSpecified ? Math.max(0, props.extrudeHeight) : (updated.extrudeHeight || 0);

                if (updated.operation === 'REVOLVE' || updated.revolveData) {
                    const rData = updated.revolveData || {};
                    const prof = updated.profile || new Profile2D(updated);
                    updated.solidMesh = RevolveEngine.revolve(prof, rData.axis, rData.angleDeg, rData.isSurface, rData.reversed);
                    updated.kind = rData.isSurface ? GEOMETRY_KIND.SURFACE_3D : GEOMETRY_KIND.SOLID_3D;
                } else if (heightSpecified || (pointsChanged && currentHeight > 0.01)) {
                    if (currentHeight > 0.01) {
                        const prof = updated.profile || new Profile2D({
                            points: updated.points || [updated.start, updated.end],
                            type: updated.type,
                            isClosed: updated.type === 'RECTANGLE' || updated.type === 'CIRCLE'
                        });
                        updated.profile = prof;
                        updated.extrudeHeight = currentHeight;
                        updated.solidMesh = ExtrusionEngine.extrude(prof, currentHeight);
                        updated.kind = updated.solidMesh ? updated.solidMesh.kind : GEOMETRY_KIND.SOLID_3D;
                    } else {
                        updated.kind = GEOMETRY_KIND.SKETCH_2D;
                        updated.solidMesh = null;
                        updated.extrudeHeight = 0;
                    }
                }
                return updated;
            })
        })),

        /**
         * Extrude a 2D profile or existing object into a 3D solid model.
         * Primary CAD operation: Sketch -> Profile -> Solid
         */
        extrudeObject: (objectId, height = null) => {
            const id = objectId || get().selectedObjectId;
            if (!id) return;
            const current = get().cadObjects.find((o) => o.id === id);
            if (!current) return;

            const targetHeight = (typeof height === 'number' && height > 0)
                ? height
                : (get().defaultExtrudeHeight || 2.0);
            get().updateCADObject(id, {
                extrudeHeight: targetHeight,
                scaleZ: targetHeight
            });
        },

        // ---------------------------------------------
        // CAD REVOLVE (LATHE) OPERATIONS
        // ---------------------------------------------

        /**
         * Re-run ProfileDetector on current cadObjects and store results.
         * Call this whenever objects change or revolve mode is opened.
         */
        detectProfiles: () => set((state) => ({
            detectedProfiles: ProfileDetector.detect(state.cadObjects)
        })),

        startRevolveMode: (initialProfileId = null) => set((state) => {
            const freshProfiles = ProfileDetector.detect(state.cadObjects);

            // Resolve raw segment id → owning SketchProfile id
            const rawId = initialProfileId || state.selectedObjectId;
            let resolvedProfileId = null;
            if (rawId) {
                const direct = freshProfiles.find(p => p.id === rawId);
                const owner  = direct ?? freshProfiles.find(p => p.segmentIds.includes(rawId));
                if (owner) resolvedProfileId = owner.id;
            }

            const hasProf = !!resolvedProfileId;
            return {
                detectedProfiles: freshProfiles,
                revolveState: {
                    active: true,
                    step: hasProf ? 'SELECT_AXIS' : 'SELECT_PROFILE',
                    selectedProfileId: hasProf ? resolvedProfileId : null,
                    selectedAxis: 'PROFILE_LEFT',
                    angleDeg: 360,
                    isSurface: false,
                    reversed: false,
                    previewEnabled: true,
                    errorMessage: null
                }
            };
        }),

        cancelRevolveMode: () => set({
            revolveState: {
                active: false,
                step: 'SELECT_PROFILE',
                selectedProfileId: null,
                selectedAxis: 'PROFILE_LEFT',
                angleDeg: 360,
                isSurface: false,
                reversed: false,
                previewEnabled: true,
                errorMessage: null
            }
        }),

        setRevolveProfile: (profileId) => set((state) => {
            // profileId may be a SketchProfile id or a raw segment id
            const sketchProf = state.detectedProfiles.find(p => p.id === profileId)
                ?? state.detectedProfiles.find(p => p.segmentIds.includes(profileId));

            if (sketchProf) {
                // Build a temporary Profile2D from merged points for validation
                const tempProf = new Profile2D({
                    points: sketchProf.points,
                    type: 'FREEHAND',
                    isClosed: sketchProf.isClosed
                });
                const val = RevolveEngine.validateProfileForRevolve(tempProf, state.revolveState.selectedAxis, state.revolveState.isSurface);
                return {
                    revolveState: {
                        ...state.revolveState,
                        selectedProfileId: sketchProf.id,
                        step: 'SELECT_AXIS',
                        errorMessage: val.valid ? null : val.error
                    }
                };
            }

            // Fallback: raw CAD object
            const obj = state.cadObjects.find((o) => o.id === profileId);
            if (!obj) return state;
            const val = RevolveEngine.validateProfileForRevolve(obj.profile || obj, state.revolveState.selectedAxis, state.revolveState.isSurface);
            return {
                selectedObjectId: profileId,
                revolveState: {
                    ...state.revolveState,
                    selectedProfileId: profileId,
                    step: 'SELECT_AXIS',
                    errorMessage: val.valid ? null : val.error
                }
            };
        }),

        setRevolveAxis: (axis) => set((state) => {
            const profObj = state.cadObjects.find((o) => o.id === state.revolveState.selectedProfileId);
            let errMsg = null;
            if (profObj) {
                const val = RevolveEngine.validateProfileForRevolve(profObj.profile || profObj, axis, state.revolveState.isSurface);
                if (!val.valid) errMsg = val.error;
            }
            return {
                revolveState: {
                    ...state.revolveState,
                    selectedAxis: axis,
                    step: 'ADJUST_SETTINGS',
                    errorMessage: errMsg
                }
            };
        }),

        setRevolveAngle: (angle) => set((state) => ({
            revolveState: {
                ...state.revolveState,
                angleDeg: Math.max(1, Math.min(360, Number(angle) || 360))
            }
        })),

        setRevolveSurface: (isSurface) => set((state) => ({
            revolveState: {
                ...state.revolveState,
                isSurface: !!isSurface,
                errorMessage: null
            }
        })),

        toggleRevolveDirection: () => set((state) => ({
            revolveState: {
                ...state.revolveState,
                reversed: !state.revolveState.reversed
            }
        })),

        toggleRevolvePreview: () => set((state) => ({
            revolveState: {
                ...state.revolveState,
                previewEnabled: !state.revolveState.previewEnabled
            }
        })),

        commitRevolve: () => {
            const state = get();
            const { selectedProfileId, selectedAxis, angleDeg, isSurface, reversed } = state.revolveState;
            if (!selectedProfileId) {
                set((s) => ({ revolveState: { ...s.revolveState, errorMessage: 'Please select a profile first.' } }));
                return;
            }

            // ── Resolve the profile: SketchProfile (merged) or raw CAD object ──
            const sketchProf = state.detectedProfiles.find(p => p.id === selectedProfileId);

            let mergedProfile, sourcePoints, sourcePlanePos, sourcePlaneRot;

            if (sketchProf) {
                mergedProfile = new Profile2D({
                    points:   sketchProf.points,
                    type:     'FREEHAND',
                    isClosed: sketchProf.isClosed
                });
                sourcePoints    = sketchProf.points;
                sourcePlanePos  = sketchProf.planePosition ?? [...state.planePosition];
                sourcePlaneRot  = sketchProf.planeRotation ?? [...state.planeRotation];
            } else {
                const profileObj = state.cadObjects.find((o) => o.id === selectedProfileId);
                if (!profileObj) {
                    set((s) => ({ revolveState: { ...s.revolveState, errorMessage: 'Selected profile not found.' } }));
                    return;
                }
                mergedProfile   = profileObj.profile || new Profile2D(profileObj);
                sourcePoints    = profileObj.points || (profileObj.start && profileObj.end ? [profileObj.start, profileObj.end] : []);
                sourcePlanePos  = profileObj.planePosition ? [...profileObj.planePosition] : [...state.planePosition];
                sourcePlaneRot  = profileObj.planeRotation ? [...profileObj.planeRotation] : [...state.planeRotation];
            }

            const val = RevolveEngine.validateProfileForRevolve(mergedProfile, selectedAxis, isSurface);
            if (!val.valid) {
                set((s) => ({ revolveState: { ...s.revolveState, errorMessage: val.error } }));
                return;
            }

            const solidMesh = RevolveEngine.revolve(mergedProfile, selectedAxis, angleDeg, isSurface, reversed);
            if (!solidMesh) {
                set((s) => ({ revolveState: { ...s.revolveState, errorMessage: 'Failed to generate revolve solid.' } }));
                return;
            }

            const newObj = {
                id: `cad_revolve_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                type: isSurface ? 'REVOLVE_SURFACE' : 'REVOLVE_SOLID',
                kind: isSurface ? GEOMETRY_KIND.SURFACE_3D : GEOMETRY_KIND.SOLID_3D,
                operation: 'REVOLVE',
                profile: mergedProfile,
                points: sourcePoints,
                solidMesh: solidMesh,
                extrudeHeight: 0,
                revolveData: {
                    sketchProfileId: sketchProf?.id ?? null,
                    segmentIds: sketchProf?.segmentIds ?? [selectedProfileId],
                    axis: selectedAxis,
                    angleDeg: angleDeg,
                    isSurface: isSurface,
                    reversed: reversed
                },
                isClosed: !isSurface,
                planePosition: sourcePlanePos,
                planeRotation: sourcePlaneRot,
                createdAt: Date.now()
            };

            state.addCADObject(newObj);
            state.cancelRevolveMode();
            state.selectObject(newObj.id);
        },

        /**
         * Manually change length and dimensions in centimeters (cm) with full undo/redo support.
         * Supports:
         * - Line: lengthCm
         * - Rectangle: widthCm, lengthCm
         * - Circle: radiusCm, diameterCm
         * - Freehand: lengthCm (perimeter/scale)
         * - Extruded Solid: extrudeHeight (cm)
         */
        updateObjectDimensions: (objectId, changes = {}) => {
            const id = objectId || get().selectedObjectId;
            if (!id) return;
            const obj = get().cadObjects.find((o) => o.id === id);
            if (!obj) return;

            let updates = {};

            // Handle Extrusion height in cm
            if (changes.extrudeHeight !== undefined) {
                const h = Math.max(0, Number(changes.extrudeHeight));
                updates.extrudeHeight = h;
                updates.scaleZ = h;
            }

            // Handle 2D base sketch dimension adjustments in cm
            if (obj.type === 'LINE' && changes.lengthCm !== undefined) {
                const lineUpdates = resizeLineInCm(obj, changes.lengthCm);
                if (lineUpdates) Object.assign(updates, lineUpdates);
            } else if (obj.type === 'RECTANGLE' && (changes.widthCm !== undefined || changes.lengthCm !== undefined)) {
                const rectUpdates = resizeRectangleInCm(obj, { widthCm: changes.widthCm, lengthCm: changes.lengthCm });
                if (rectUpdates) Object.assign(updates, rectUpdates);
            } else if (obj.type === 'CIRCLE' && (changes.radiusCm !== undefined || changes.diameterCm !== undefined)) {
                const r = changes.radiusCm !== undefined ? Number(changes.radiusCm) : (Number(changes.diameterCm) / 2);
                const circleUpdates = resizeCircleInCm(obj, r);
                if (circleUpdates) Object.assign(updates, circleUpdates);
            } else if (changes.lengthCm !== undefined && obj.type !== 'LINE' && obj.type !== 'RECTANGLE') {
                const freehandUpdates = resizeFreehandInCm(obj, changes.lengthCm);
                if (freehandUpdates) Object.assign(updates, freehandUpdates);
            }

            if (Object.keys(updates).length > 0) {
                get().updateCADObject(id, updates);
            }
        },

        /**
         * Update a CAD object's transform properties with undo support.
         * Used by Z-axis elongation and similar transforms.
         */
        updateCADObject: (objectId, newProps) => {
            const current = get().cadObjects.find((o) => o.id === objectId);
            if (!current) return;
            const oldProps = {};
            Object.keys(newProps).forEach((k) => { oldProps[k] = current[k]; });
            const storeApi = {
                internalAddObject: get().internalAddObject,
                internalRemoveObject: get().internalRemoveObject,
                internalSetObjects: get().internalSetObjects,
                internalUpdateObject: get().internalUpdateObject
            };
            const command = new UpdateCADObjectCommand(objectId, oldProps, newProps, storeApi);
            cadCommandManager.execute(command);
        },

        // ---------------------------------------------
        // LEGACY BACKWARDS-COMPATIBILITY ALIASES
        // ---------------------------------------------
        undoLine: () => get().undo(),
        clearLines: () => get().clearCADObjects(),
        setLines: (lines) => get().setCADObjects(lines)
    };
});
