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
    UpdateCADObjectCommand
} from '../cad/commands/CADCommands';

export const useCadStore = create((set, get) => {
    // Synchronize CommandManager stack availability with store
    cadCommandManager.onStackChange = ({ canUndo, canRedo }) => {
        set({ canUndo, canRedo });
    };

    return {
        // ---------------------------------------------
        // PERSISTENT CAD OBJECTS
        // ---------------------------------------------
        cadObjects: [],
        drawingMode: 'FREEHAND', // 'FREEHAND' | 'LINE' | 'RECTANGLE'
        
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
                set({ drawingMode: mode });
            }
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

        toggleZHoldMode: () => set((state) => ({ zHoldModeEnabled: !state.zHoldModeEnabled })),

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
                // Isometric 3D angle
                rot = [0, 0, 0];
                normal = [0, 1, 0];
                camPos = [px + 7, py + 7, pz + 7];
                camUp = [0, 1, 0];
            }

            return { 
                planeRotation: rot, 
                activePreset: preset,
                activePlaneNormal: normal,
                cameraTargetPosition: camPos,
                cameraTargetUp: camUp
            };
        }),

        setPlaneOffset: (axis, value) => set((state) => {
            const current = [...state.planePosition];
            if (axis === 'X') current[0] = value;
            else if (axis === 'Y') current[1] = value;
            else if (axis === 'Z') current[2] = value;
            else if (typeof axis === 'number') current[1] = axis; // backwards compatibility
            return { planePosition: current };
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
        internalAddObject: (obj) => set((state) => ({ cadObjects: [...state.cadObjects, obj] })),
        internalRemoveObject: (id) => set((state) => ({ 
            cadObjects: state.cadObjects.filter((o) => o.id !== id) 
        })),
        internalSetObjects: (objects) => set({ cadObjects: objects }),
        internalUpdateObject: (id, props) => set((state) => ({
            cadObjects: state.cadObjects.map((o) => o.id === id ? { ...o, ...props } : o)
        })),

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
