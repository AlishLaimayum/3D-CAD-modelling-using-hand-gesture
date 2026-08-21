import { create } from 'zustand';

export const useCadStore = create((set, get) => ({
    gestureState: 'IDLE',
    planeLocked: false,
    activePlaneNormal: [0, 1, 0],
    activePlaneOrigin: [0, 0, 0],
    planeRotation: [0, 0, 0],
    planePosition: [0, 0, 0],
    activePreset: 'TOP',
    lines: [],
    currentLine: null,
    cursorPosition: null,
    
    // Magnetic lock state
    magneticLockEnabled: true,
    snapDistance: 0.25, // Responsive 3D snapping distance
    isSnapped: false,
    snappedPoint: null,

    setGestureState: (state) => set({ gestureState: state }),
    setPlaneLocked: (locked) => set({ planeLocked: locked }),
    setPlaneRotation: (rotation) => set({ planeRotation: rotation }),
    setPlanePosition: (position) => set({ planePosition: position }),
    setCursorPosition: (pos) => set({ cursorPosition: pos }),
    
    setPresetPlane: (preset) => set(() => {
        let rot = [0, 0, 0];
        if (preset === 'FRONT') rot = [Math.PI / 2, 0, 0];
        else if (preset === 'SIDE') rot = [0, 0, Math.PI / 2];
        else if (preset === 'TOP') rot = [0, 0, 0];
        else if (preset === 'ISO') rot = [Math.PI / 4, Math.PI / 4, 0];
        return { planeRotation: rot, activePreset: preset };
    }),

    setPlaneOffset: (offsetY) => set((state) => ({
        planePosition: [state.planePosition[0], offsetY, state.planePosition[2]]
    })),

    toggleMagneticLock: () => set((state) => ({ magneticLockEnabled: !state.magneticLockEnabled })),
    setMagneticLockEnabled: (enabled) => set({ magneticLockEnabled: enabled }),
    setSnapDistance: (dist) => set({ snapDistance: dist }),
    setSnappedInfo: (info) => set({ isSnapped: info.isSnapped, snappedPoint: info.point || null }),

    startLine: (pos) => set({ currentLine: { start: pos, end: pos } }),
    extendLine: (pos) => set((state) => ({ 
        currentLine: state.currentLine ? { ...state.currentLine, end: pos } : null 
    })),
    finalizeLine: () => set((state) => {
        if (!state.currentLine) return state;
        const s = state.currentLine.start;
        const e = state.currentLine.end;
        const dist = Math.hypot(e[0] - s[0], e[1] - s[1], e[2] - s[2]);
        if (dist < 0.001) return { currentLine: null };
        return {
            lines: [...state.lines, state.currentLine],
            currentLine: null
        };
    }),
    undoLine: () => set((state) => ({ lines: state.lines.slice(0, -1) })),
    clearLines: () => set({ lines: [], currentLine: null }),
    setLines: (lines) => set({ lines, currentLine: null })
}));
