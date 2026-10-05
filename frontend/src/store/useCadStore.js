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
    SolidMesh 
} from '../cad/geometry/index.js';
import { faceToEuler } from '../cad/geometry/FaceEnumerator.js';

export const useCadStore = create((set, get) => {
    // Synchronize CommandManager stack availability with store
    cadCommandManager.onStackChange = ({ canUndo, canRedo }) => {
        set({ canUndo, canRedo });
    };

    return {
        // ---------------------------------------------
        // PERSISTENT CAD OBJECTS & SELECTION
        // ---------------------------------------------
        cadObjects: [],
        selectedObjectId: null,
        hoveredObjectId: null,
        drawingMode: 'SELECT', // 'SELECT' | 'FREEHAND' | 'LINE' | 'RECTANGLE' | 'CIRCLE'

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
                const updates = { drawingMode: mode };
                // Clear object selection when switching to a drawing tool UNLESS a face is selected
                if (mode !== 'SELECT' && !get().selectedFace) {
                    updates.selectedObjectId = null;
                }
                set(updates);
            }
        },

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

        // Called ONLY by gesture rotation. Updates the working plane AND syncs every
        // existing object's frozen planeRotation so geometry rigidly follows the plane.
        // XY/YZ/XZ preset switches must NOT call this — they use setPlaneRotation so
        // completed objects stay at their original world positions.
        gestureRotatePlane: (rotation) => set((state) => ({
            planeRotation: rotation,
            cadObjects: state.cadObjects.map((o) => ({ ...o, planeRotation: rotation }))
        })),

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

                if (props.extrudeHeight !== undefined) {
                    const h = Math.max(0, props.extrudeHeight);
                    if (h > 0.01) {
                        if (updated.solidMesh && typeof updated.solidMesh.setExtrusionHeight === 'function') {
                            updated.solidMesh.setExtrusionHeight(h);
                            updated.kind = updated.solidMesh.kind;
                        } else {
                            const prof = updated.profile || new Profile2D({
                                points: updated.points || [updated.start, updated.end],
                                type: updated.type,
                                isClosed: updated.type === 'RECTANGLE' || updated.type === 'CIRCLE'
                            });
                            updated.profile = prof;
                            updated.solidMesh = ExtrusionEngine.extrude(prof, h);
                            updated.kind = updated.solidMesh.kind;
                        }
                    } else {
                        updated.kind = GEOMETRY_KIND.SKETCH_2D;
                        updated.solidMesh = null;
                    }
                }
                return updated;
            })
        })),

        /**
         * Extrude a 2D profile or existing object into a 3D solid model.
         * Primary CAD operation: Sketch -> Profile -> Solid
         */
        extrudeObject: (objectId, height = 1.0) => {
            const id = objectId || get().selectedObjectId;
            if (!id) return;
            const current = get().cadObjects.find((o) => o.id === id);
            if (!current) return;

            const targetHeight = (typeof height === 'number' && height > 0) ? height : 1.5;
            get().updateCADObject(id, {
                extrudeHeight: targetHeight,
                scaleZ: targetHeight
            });
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
