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
    ClearCADObjectsCommand 
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
        activePreset: 'TOP',
        planeRotation: [0, 0, 0],
        planePosition: [0, 0, 0],
        activePlaneNormal: [0, 1, 0],
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

        cameraTargetPosition: null,

        setCameraTargetPosition: (pos) => set({ cameraTargetPosition: pos }),

        setPresetPlane: (preset) => set((state) => {
            let rot = [0, 0, 0];
            let camPos = [6, 6, 6];

            if (preset === 'FRONT') {
                rot = [Math.PI / 2, 0, 0];
                // Looking straight at the XY plane along +Z
                camPos = [state.planePosition[0], state.planePosition[1], 8];
            } else if (preset === 'SIDE') {
                rot = [0, 0, Math.PI / 2];
                // Looking straight at the YZ plane along +X
                camPos = [8, state.planePosition[1], state.planePosition[2]];
            } else if (preset === 'TOP') {
                rot = [0, 0, 0];
                // True top view looking straight down along -Y
                camPos = [state.planePosition[0], 9, state.planePosition[2] + 0.0001];
            } else if (preset === 'ISO') {
                rot = [Math.PI / 4, Math.PI / 4, 0];
                camPos = [6, 6, 6];
            }

            return { 
                planeRotation: rot, 
                activePreset: preset,
                cameraTargetPosition: camPos
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

        // ---------------------------------------------
        // LEGACY BACKWARDS-COMPATIBILITY ALIASES
        // ---------------------------------------------
        undoLine: () => get().undo(),
        clearLines: () => get().clearCADObjects(),
        setLines: (lines) => get().setCADObjects(lines)
    };
});
