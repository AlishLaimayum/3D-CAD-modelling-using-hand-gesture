/**
 * UIOverlay.jsx - 3D CAD Modeling Interface & Precision Controls HUD
 * 
 * Provides:
 * - Granular Zustand selectors to prevent unnecessary rerenders
 * - Drawing Mode Switcher (Freehand Curve, Straight Line, Rectangle)
 * - Precision Snapping Controls (Magnetic Lock, Grid Snap, Angle Snap)
 * - Full Undo / Redo with Command Pattern & Keyboard Shortcuts
 * - Wavefront OBJ, DXF, JSON, and PNG Viewport Exporters
 * - Real-Time Status & Performance Diagnostics HUD Toggle
 */

import { useRef, useEffect } from 'react';
import { useCadStore } from '../store/useCadStore';
import {
    exportToOBJ,
    exportToDXF,
    exportToJSON,
    exportSnapshotPNG
} from '../utils/exportUtils';
import {
    Magnet,
    RotateCcw,
    RotateCw,
    Trash2,
    Upload,
    Camera,
    Box,
    FileCode,
    Layers,
    Compass,
    MoveUp,
    MoveDown,
    Pencil,
    Minus,
    Square,
    Grid,
    CornerDownRight,
    Activity,
    ArrowUpDown
} from 'lucide-react';

export function UIOverlay() {
    // ---------------------------------------------
    // GRANULAR ZUSTAND SELECTORS (ZERO UNNECESSARY RERENDERS)
    // ---------------------------------------------
    const gestureState = useCadStore((state) => state.gestureState);
    const planeLocked = useCadStore((state) => state.planeLocked);
    const planePosition = useCadStore((state) => state.planePosition);
    const planeRotation = useCadStore((state) => state.planeRotation);
    const activePreset = useCadStore((state) => state.activePreset);
    const cadObjects = useCadStore((state) => state.cadObjects);
    const drawingMode = useCadStore((state) => state.drawingMode);

    // Snapping configuration
    const magneticLockEnabled = useCadStore((state) => state.magneticLockEnabled);
    const gridSnapEnabled = useCadStore((state) => state.gridSnapEnabled);
    const angleSnapEnabled = useCadStore((state) => state.angleSnapEnabled);
    const isSnapped = useCadStore((state) => state.isSnapped);
    const snappedPoint = useCadStore((state) => state.snappedPoint);

    // Undo / Redo
    const canUndo = useCadStore((state) => state.canUndo);
    const canRedo = useCadStore((state) => state.canRedo);
    const diagnosticsEnabled = useCadStore((state) => state.diagnosticsEnabled);

    // Store Actions
    const setDrawingMode = useCadStore((state) => state.setDrawingMode);
    const toggleMagneticLock = useCadStore((state) => state.toggleMagneticLock);
    const toggleGridSnap = useCadStore((state) => state.toggleGridSnap);
    const toggleAngleSnap = useCadStore((state) => state.toggleAngleSnap);
    const undo = useCadStore((state) => state.undo);
    const redo = useCadStore((state) => state.redo);
    const clearCADObjects = useCadStore((state) => state.clearCADObjects);
    const setCADObjects = useCadStore((state) => state.setCADObjects);
    const setPresetPlane = useCadStore((state) => state.setPresetPlane);
    const setPlaneOffset = useCadStore((state) => state.setPlaneOffset);
    const toggleDiagnostics = useCadStore((state) => state.toggleDiagnostics);

    // Z-Axis Elongation HOLD mode
    const zHoldModeEnabled = useCadStore((state) => state.zHoldModeEnabled);
    const toggleZHoldMode  = useCadStore((state) => state.toggleZHoldMode);

    const fileInputRef = useRef(null);

    // ---------------------------------------------
    // GLOBAL KEYBOARD SHORTCUTS
    // ---------------------------------------------
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Undo: Ctrl+Z or Cmd+Z
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            // Redo: Ctrl+Y or Ctrl+Shift+Z
            else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                e.preventDefault();
                redo();
            }
            // Mode shortcuts: 1=Freehand, 2=Line, 3=Rectangle
            else if (e.key === '1') {
                setDrawingMode('FREEHAND');
            } else if (e.key === '2') {
                setDrawingMode('LINE');
            } else if (e.key === '3') {
                setDrawingMode('RECTANGLE');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, setDrawingMode]);

    // Handle Project JSON File Import
    const handleImportJSON = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.cadObjects && Array.isArray(data.cadObjects)) {
                    setCADObjects(data.cadObjects);
                    alert(`Loaded CAD project with ${data.cadObjects.length} object(s).`);
                } else if (data.lines && Array.isArray(data.lines)) {
                    // Backwards-compatible line import
                    setCADObjects(data.lines);
                    alert(`Loaded legacy project with ${data.lines.length} segment(s).`);
                } else {
                    alert('Invalid JSON structure: missing cadObjects array.');
                }
            } catch (_err) {
                console.error('JSON parse error:', _err);
                alert('Error parsing JSON file.');
            }
        };
        reader.readAsText(file);
    };

    // Calculate total stored points
    let totalPoints = 0;
    cadObjects.forEach((obj) => {
        if (obj.points) totalPoints += obj.points.length;
        else if (obj.start && obj.end) totalPoints += 2;
    });

    return (
        <>
            {/* ---------------------------------------------
                STATUS PANEL (TOP LEFT)
            --------------------------------------------- */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: 20,
                color: 'white',
                background: 'rgba(15, 18, 28, 0.88)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                padding: '18px 20px',
                borderRadius: '14px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                pointerEvents: 'auto',
                zIndex: 10,
                minWidth: '260px',
                boxShadow: '0 10px 35px rgba(0,0,0,0.5)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.15)',
                    paddingBottom: '8px',
                    marginBottom: '12px'
                }}>
                    <h3 style={{
                        margin: 0,
                        color: '#00f0ff',
                        fontSize: '14px',
                        letterSpacing: '1px',
                        fontWeight: '700'
                    }}>
                        3D CAD STATUS
                    </h3>
                    <button
                        onClick={toggleDiagnostics}
                        title="Toggle Performance Diagnostics HUD [D]"
                        style={{
                            background: diagnosticsEnabled ? 'rgba(0,240,255,0.2)' : 'transparent',
                            border: '1px solid rgba(0,240,255,0.4)',
                            color: '#00f0ff',
                            borderRadius: '6px',
                            padding: '3px 6px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <Activity size={12} />
                        <span>HUD</span>
                    </button>
                </div>

                <div style={{ margin: '6px 0', fontSize: '12px' }}>
                    <strong>Active Plane:</strong> <span style={{ color: '#00ffff', fontWeight: 'bold' }}>{activePreset} PLANE</span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '12px' }}>
                    <strong>Plane Elevation (Y):</strong> <span style={{ color: '#ffea00', fontWeight: 'bold' }}>{planePosition[1].toFixed(2)}</span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '12px' }}>
                    <strong>Gesture:</strong> <span style={{
                        color: gestureState === 'DRAWING' || gestureState === 'PINCH' ? '#ff0055' : (gestureState === 'ROTATING' ? '#ffea00' : '#00ffff'),
                        fontWeight: 'bold'
                    }}>
                        {gestureState}
                    </span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '12px' }}>
                    <strong>Plane Lock:</strong> <span style={{ color: planeLocked ? '#ff4455' : '#00ff66', fontWeight: 'bold' }}>
                        {planeLocked ? 'LOCKED (Draw Active)' : 'UNLOCKED (Rotate Active)'}
                    </span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '12px' }}>
                    <strong>Tool Mode:</strong> <span style={{ color: '#ffea00', fontWeight: 'bold' }}>{drawingMode}</span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '12px' }}>
                    <strong>Precision Snap:</strong> <span style={{ color: isSnapped ? '#00ff66' : '#888888', fontWeight: 'bold' }}>
                        {isSnapped ? 'SNAP LOCKED 🧲' : (magneticLockEnabled ? 'ACTIVE' : 'DISABLED')}
                    </span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '12px' }}>
                    <strong>CAD Objects:</strong> <span style={{ color: '#00ffff', fontWeight: 'bold' }}>{cadObjects.length}</span>
                    <span style={{ color: '#888', fontSize: '11px', marginLeft: '6px' }}>({totalPoints} pts)</span>
                </div>

                {zHoldModeEnabled && (
                    <div style={{
                        marginTop: '8px',
                        padding: '6px 10px',
                        background: 'rgba(255,170,0,0.12)',
                        border: '1px solid rgba(255,170,0,0.4)',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#ffaa00',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <ArrowUpDown size={12} />
                        <span><strong>Z-HOLD ACTIVE</strong> — Drag object to elongate along Z axis</span>
                    </div>
                )}

                {isSnapped && snappedPoint && (
                    <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(0,255,102,0.1)', borderRadius: '6px', fontSize: '11px', color: '#00ff66' }}>
                        📍 Snapped: [{snappedPoint[0].toFixed(2)}, {snappedPoint[1].toFixed(2)}, {snappedPoint[2].toFixed(2)}]
                    </div>
                )}
            </div>

            {/* ---------------------------------------------
                DRAWING TOOL SELECTOR & SNAPPING BAR (TOP CENTER)
            --------------------------------------------- */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 18, 28, 0.9)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '30px',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 20,
                boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
            }}>
                {/* Freehand Tool */}
                <button
                    onClick={() => setDrawingMode('FREEHAND')}
                    title="Freehand Curve Tool [1] - Preserves all drawn coordinates"
                    style={toolBtnStyle(drawingMode === 'FREEHAND')}
                >
                    <Pencil size={15} />
                    <span>Freehand</span>
                </button>

                {/* Line Tool */}
                <button
                    onClick={() => setDrawingMode('LINE')}
                    title="Straight Line Tool [2]"
                    style={toolBtnStyle(drawingMode === 'LINE')}
                >
                    <Minus size={15} />
                    <span>Line</span>
                </button>

                {/* Rectangle Tool */}
                <button
                    onClick={() => setDrawingMode('RECTANGLE')}
                    title="Rectangle Tool [3]"
                    style={toolBtnStyle(drawingMode === 'RECTANGLE')}
                >
                    <Square size={15} />
                    <span>Rectangle</span>
                </button>

                {/* Z-Axis Elongation HOLD Mode */}
                <button
                    id="btn-z-hold"
                    onClick={toggleZHoldMode}
                    title="Toggle Z-Elongation HOLD mode: pinch/click an object and drag along Z to scale it"
                    style={{
                        ...toolBtnStyle(zHoldModeEnabled),
                        border: zHoldModeEnabled ? '1px solid #ffaa00' : '1px solid rgba(255,255,255,0.15)',
                        background: zHoldModeEnabled
                            ? 'linear-gradient(135deg, #ff8c00, #ffaa00)'
                            : '#1a1f2c',
                        color: zHoldModeEnabled ? '#000' : '#ccc',
                        boxShadow: zHoldModeEnabled ? '0 0 14px rgba(255,170,0,0.55)' : 'none',
                    }}
                >
                    <ArrowUpDown size={15} />
                    <span>HOLD</span>
                </button>

                <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

                {/* Magnetic Snap Toggle */}
                <button
                    onClick={toggleMagneticLock}
                    title="Toggle Magnetic Snap Lock (Vertex/Midpoint)"
                    style={{
                        ...btnStyle,
                        background: magneticLockEnabled ? 'rgba(0, 198, 255, 0.25)' : 'transparent',
                        borderColor: magneticLockEnabled ? '#00c6ff' : 'rgba(255,255,255,0.15)',
                        color: magneticLockEnabled ? '#00f0ff' : '#888'
                    }}
                >
                    <Magnet size={15} />
                    <span>Magnet</span>
                </button>

                {/* Grid Snap Toggle */}
                <button
                    onClick={toggleGridSnap}
                    title="Toggle Grid Coordinate Snap"
                    style={{
                        ...btnStyle,
                        background: gridSnapEnabled ? 'rgba(0, 255, 102, 0.2)' : 'transparent',
                        borderColor: gridSnapEnabled ? '#00ff66' : 'rgba(255,255,255,0.15)',
                        color: gridSnapEnabled ? '#00ff66' : '#888'
                    }}
                >
                    <Grid size={15} />
                    <span>Grid</span>
                </button>

                {/* Angle Snap Toggle */}
                <button
                    onClick={toggleAngleSnap}
                    title="Toggle 45°/90° Angle Snap"
                    style={{
                        ...btnStyle,
                        background: angleSnapEnabled ? 'rgba(255, 234, 0, 0.2)' : 'transparent',
                        borderColor: angleSnapEnabled ? '#ffea00' : 'rgba(255,255,255,0.15)',
                        color: angleSnapEnabled ? '#ffea00' : '#888'
                    }}
                >
                    <CornerDownRight size={15} />
                    <span>45° Snap</span>
                </button>

                <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

                {/* Undo / Redo */}
                <button
                    onClick={undo}
                    disabled={!canUndo}
                    title="Undo [Ctrl+Z]"
                    style={{ ...btnStyle, opacity: canUndo ? 1 : 0.35, padding: '7px 10px' }}
                >
                    <RotateCcw size={15} />
                </button>

                <button
                    onClick={redo}
                    disabled={!canRedo}
                    title="Redo [Ctrl+Y]"
                    style={{ ...btnStyle, opacity: canRedo ? 1 : 0.35, padding: '7px 10px' }}
                >
                    <RotateCw size={15} />
                </button>

                {/* Clear All */}
                <button
                    onClick={clearCADObjects}
                    disabled={cadObjects.length === 0}
                    title="Clear all CAD geometry"
                    style={{
                        ...btnStyle,
                        background: 'rgba(255,68,85,0.15)',
                        borderColor: 'rgba(255,68,85,0.4)',
                        color: '#ff4455',
                        opacity: cadObjects.length === 0 ? 0.35 : 1,
                        padding: '7px 10px'
                    }}
                >
                    <Trash2 size={15} />
                </button>
            </div>

            {/* ---------------------------------------------
                EXPORT / IMPORT TOOLBAR (TOP RIGHT INSTRUCTION AREA)
            --------------------------------------------- */}
            <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                zIndex: 10
            }}>
                {/* Exporter Buttons */}
                <div style={{
                    background: 'rgba(15, 18, 28, 0.88)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '14px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}>
                    <button
                        onClick={() => exportToOBJ(cadObjects, planeRotation)}
                        title="Export Wavefront 3D OBJ file"
                        style={btnStyle}
                    >
                        <Box size={15} color="#00ffff" />
                        <span>OBJ</span>
                    </button>

                    <button
                        onClick={() => exportToDXF(cadObjects)}
                        title="Export AutoCAD DXF file"
                        style={btnStyle}
                    >
                        <Layers size={15} color="#00ff66" />
                        <span>DXF</span>
                    </button>

                    <button
                        onClick={() => exportToJSON(cadObjects, planeRotation)}
                        title="Export CAD Project JSON"
                        style={btnStyle}
                    >
                        <FileCode size={15} color="#ffea00" />
                        <span>JSON</span>
                    </button>

                    <button
                        onClick={() => exportSnapshotPNG()}
                        title="Download 3D Viewport PNG Snapshot"
                        style={btnStyle}
                    >
                        <Camera size={15} color="#ff44aa" />
                        <span>PNG</span>
                    </button>

                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Load CAD Project JSON"
                        style={btnStyle}
                    >
                        <Upload size={15} />
                        <span>Load</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportJSON}
                        accept=".json"
                        style={{ display: 'none' }}
                    />
                </div>

                {/* Gesture & Quick Help Guide */}
                <div style={{
                    color: 'white',
                    background: 'rgba(15, 18, 28, 0.88)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '16px 18px',
                    borderRadius: '14px',
                    fontFamily: 'sans-serif',
                    width: '280px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}>
                    <h3 style={{
                        marginTop: 0,
                        marginBottom: '10px',
                        borderBottom: '1px solid rgba(255,255,255,0.15)',
                        paddingBottom: '6px',
                        fontFamily: 'monospace',
                        color: '#00f0ff',
                        fontSize: '13px',
                        letterSpacing: '1px'
                    }}>
                        GESTURE CAD GUIDE
                    </h3>

                    {/* Mouse Draw */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '15px', width: '26px' }}>🖱️</span>
                        <div>
                            <strong style={{ display: 'block', color: '#00ffff', fontSize: '11px' }}>MOUSE DRAW</strong>
                            <span style={{ fontSize: '10px', color: '#aaa' }}>Click & Drag to draw on 3D plane.</span>
                        </div>
                    </div>

                    {/* Open Palm */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '15px', width: '26px' }}>✋</span>
                        <div>
                            <strong style={{ display: 'block', color: '#00ffff', fontSize: '11px' }}>OPEN PALM</strong>
                            <span style={{ fontSize: '10px', color: '#aaa' }}>Swipe gesture to rotate 3D plane.</span>
                        </div>
                    </div>

                    {/* Fist */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '15px', width: '26px' }}>✊</span>
                        <div>
                            <strong style={{ display: 'block', color: '#ffaa00', fontSize: '11px' }}>FIST GESTURE</strong>
                            <span style={{ fontSize: '10px', color: '#aaa' }}>Lock / Unlock active plane.</span>
                        </div>
                    </div>

                    {/* Pinch */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '15px', width: '26px' }}>🤏</span>
                        <div>
                            <strong style={{ display: 'block', color: '#ffea00', fontSize: '11px' }}>PINCH GESTURE</strong>
                            <span style={{ fontSize: '10px', color: '#aaa' }}>Pinch to draw when plane is locked.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ---------------------------------------------
                3D PLANE SELECTOR BAR (BOTTOM CENTER)
            --------------------------------------------- */}
            <div style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 18, 28, 0.92)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                borderRadius: '30px',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 20,
                boxShadow: '0 10px 40px rgba(0,240,255,0.2)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00f0ff', fontSize: '12px', fontWeight: 'bold', marginRight: '2px' }}>
                    <Compass size={16} />
                    <span>3D PLANE:</span>
                </div>

                <button
                    onClick={() => setPresetPlane('XY')}
                    title="XY Plane (Normal = Z axis). Red=X horizontal, Green=Y vertical."
                    style={presetBtnStyle(activePreset === 'XY')}
                >
                    XY
                </button>

                <button
                    onClick={() => setPresetPlane('YZ')}
                    title="YZ Plane (Normal = X axis). Blue=Z horizontal, Green=Y vertical."
                    style={presetBtnStyle(activePreset === 'YZ')}
                >
                    YZ
                </button>

                <button
                    onClick={() => setPresetPlane('XZ')}
                    title="XZ Plane (Normal = Y axis). Red=X horizontal, Blue=Z vertical."
                    style={presetBtnStyle(activePreset === 'XZ')}
                >
                    XZ
                </button>

                <button
                    onClick={() => setPresetPlane('ISO')}
                    title="Isometric 3D Perspective View (45°)"
                    style={presetBtnStyle(activePreset === 'ISO')}
                >
                    ISO (3D)
                </button>

                <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.2)' }} />

                {/* X Position Offset */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '11px', color: '#ff5555', fontWeight: 'bold' }}>X:</span>
                    <button
                        onClick={() => setPlaneOffset('X', planePosition[0] - 1)}
                        title="Move Plane -1 X"
                        style={{ ...btnStyle, padding: '5px 8px', fontSize: '11px' }}
                    >
                        -1
                    </button>
                    <span style={{ fontSize: '11px', minWidth: '16px', textAlign: 'center', color: '#fff', fontWeight: '600' }}>
                        {planePosition[0]}
                    </span>
                    <button
                        onClick={() => setPlaneOffset('X', planePosition[0] + 1)}
                        title="Move Plane +1 X"
                        style={{ ...btnStyle, padding: '5px 8px', fontSize: '11px' }}
                    >
                        +1
                    </button>
                </div>

                {/* Y Position Offset (Height) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '11px', color: '#00ff66', fontWeight: 'bold' }}>Y:</span>
                    <button
                        onClick={() => setPlaneOffset('Y', planePosition[1] - 1)}
                        title="Lower Plane Height (-1 Y)"
                        style={{ ...btnStyle, padding: '5px 8px', fontSize: '11px' }}
                    >
                        -1
                    </button>
                    <span style={{ fontSize: '11px', minWidth: '16px', textAlign: 'center', color: '#fff', fontWeight: '600' }}>
                        {planePosition[1]}
                    </span>
                    <button
                        onClick={() => setPlaneOffset('Y', planePosition[1] + 1)}
                        title="Raise Plane Height (+1 Y)"
                        style={{ ...btnStyle, padding: '5px 8px', fontSize: '11px' }}
                    >
                        +1
                    </button>
                </div>

                {/* Z Position Offset */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '11px', color: '#3399ff', fontWeight: 'bold' }}>Z:</span>
                    <button
                        onClick={() => setPlaneOffset('Z', planePosition[2] - 1)}
                        title="Move Plane -1 Z"
                        style={{ ...btnStyle, padding: '5px 8px', fontSize: '11px' }}
                    >
                        -1
                    </button>
                    <span style={{ fontSize: '11px', minWidth: '16px', textAlign: 'center', color: '#fff', fontWeight: '600' }}>
                        {planePosition[2]}
                    </span>
                    <button
                        onClick={() => setPlaneOffset('Z', planePosition[2] + 1)}
                        title="Move Plane +1 Z"
                        style={{ ...btnStyle, padding: '5px 8px', fontSize: '11px' }}
                    >
                        +1
                    </button>
                </div>

                {/* Reset Origin */}
                <button
                    onClick={() => {
                        setPlaneOffset('X', 0);
                        setPlaneOffset('Y', 0);
                        setPlaneOffset('Z', 0);
                    }}
                    title="Reset Plane Origin to (0, 0, 0)"
                    style={{ ...btnStyle, fontSize: '11px', padding: '5px 10px', color: '#00f0ff', borderColor: 'rgba(0,240,255,0.3)' }}
                >
                    Reset (0,0,0)
                </button>

                <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.2)' }} />

                {/* Axis Indicator Legend */}
                <div 
                    title="3D Coordinate System Orientation (RGB = XYZ)"
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        background: 'rgba(0, 0, 0, 0.45)', 
                        padding: '4px 10px', 
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '0.5px'
                    }}
                >
                    <span style={{ color: '#888', textTransform: 'uppercase', fontSize: '10px', marginRight: '2px' }}>Axes:</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ff4444' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff4444', display: 'inline-block', boxShadow: '0 0 6px #ff4444' }} />
                        Red = X
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00e676' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00e676', display: 'inline-block', boxShadow: '0 0 6px #00e676' }} />
                        Green = Y
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2979ff' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2979ff', display: 'inline-block', boxShadow: '0 0 6px #2979ff' }} />
                        Blue = Z
                    </span>
                </div>
            </div>
        </>
    );
}

const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 12px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: '#1a1f2c',
    color: '#eee',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
};

const toolBtnStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 13px',
    borderRadius: '16px',
    border: active ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.15)',
    background: active ? 'linear-gradient(135deg, #00f0ff, #0072ff)' : '#1a1f2c',
    color: active ? '#ffffff' : '#ccc',
    fontWeight: active ? '700' : '600',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: active ? '0 0 14px rgba(0,240,255,0.45)' : 'none',
    transition: 'all 0.2s ease'
});

const presetBtnStyle = (active) => ({
    padding: '6px 12px',
    borderRadius: '16px',
    border: active ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.15)',
    background: active ? 'linear-gradient(135deg, #00f0ff, #0072ff)' : '#1a1f2c',
    color: active ? '#ffffff' : '#ccc',
    fontWeight: 'bold',
    fontSize: '11px',
    cursor: 'pointer',
    boxShadow: active ? '0 0 12px rgba(0,240,255,0.45)' : 'none',
    transition: 'all 0.2s ease'
});
