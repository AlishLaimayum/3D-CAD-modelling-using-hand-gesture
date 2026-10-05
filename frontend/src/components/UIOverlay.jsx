/**
 * UIOverlay.jsx - 3D CAD Modeling Interface & Precision Controls HUD
 *
 * Layout:
 * - Collapsible LEFT SIDEBAR: all tools, snapping, operations, export/import
 * - TOP LEFT: compact status panel (always visible)
 * - BOTTOM CENTER: 3D plane selector bar
 * - FLOATING: XY Z-Offset controller popover
 */

import { useState, useRef, useEffect } from 'react';
import { useCadStore } from '../store/useCadStore';
import {
    exportToOBJ,
    exportToDXF,
    exportToJSON,
    exportSnapshotPNG,
    exportToSTL
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
    Pencil,
    Minus,
    Square,
    Circle,
    Grid,
    CornerDownRight,
    Activity,
    ArrowUpDown,
    MousePointer,
    ChevronRight,
    ChevronLeft,
    Maximize2,
    Move,
    Download
} from 'lucide-react';

export function UIOverlay() {
    // ---------------------------------------------------
    // GRANULAR ZUSTAND SELECTORS
    // ---------------------------------------------------
    const gestureState     = useCadStore((s) => s.gestureState);
    const planeLocked      = useCadStore((s) => s.planeLocked);
    const planePosition    = useCadStore((s) => s.planePosition);
    const planeRotation    = useCadStore((s) => s.planeRotation);
    const activePreset     = useCadStore((s) => s.activePreset);
    const cadObjects       = useCadStore((s) => s.cadObjects);
    const drawingMode      = useCadStore((s) => s.drawingMode);
    const selectedObjectId = useCadStore((s) => s.selectedObjectId);

    const magneticLockEnabled = useCadStore((s) => s.magneticLockEnabled);
    const gridSnapEnabled     = useCadStore((s) => s.gridSnapEnabled);
    const angleSnapEnabled    = useCadStore((s) => s.angleSnapEnabled);
    const isSnapped           = useCadStore((s) => s.isSnapped);
    const snappedPoint        = useCadStore((s) => s.snappedPoint);

    const canUndo           = useCadStore((s) => s.canUndo);
    const canRedo           = useCadStore((s) => s.canRedo);
    const diagnosticsEnabled = useCadStore((s) => s.diagnosticsEnabled);
    const zHoldModeEnabled   = useCadStore((s) => s.zHoldModeEnabled);
    const selectedFace       = useCadStore((s) => s.selectedFace);
    const clearSelectedFace  = useCadStore((s) => s.clearSelectedFace);

    // Actions
    const setDrawingMode          = useCadStore((s) => s.setDrawingMode);
    const deselectObject          = useCadStore((s) => s.deselectObject);
    const deleteSelectedObject    = useCadStore((s) => s.deleteSelectedObject);
    const extrudeObject           = useCadStore((s) => s.extrudeObject);
    const toggleMagneticLock      = useCadStore((s) => s.toggleMagneticLock);
    const toggleGridSnap          = useCadStore((s) => s.toggleGridSnap);
    const toggleAngleSnap         = useCadStore((s) => s.toggleAngleSnap);
    const undo                    = useCadStore((s) => s.undo);
    const redo                    = useCadStore((s) => s.redo);
    const clearCADObjects         = useCadStore((s) => s.clearCADObjects);
    const setCADObjects           = useCadStore((s) => s.setCADObjects);
    const setPresetPlane          = useCadStore((s) => s.setPresetPlane);
    const setPlaneOffset          = useCadStore((s) => s.setPlaneOffset);
    const startDrawingXYWithZOffset = useCadStore((s) => s.startDrawingXYWithZOffset);
    const toggleDiagnostics       = useCadStore((s) => s.toggleDiagnostics);
    const toggleZHoldMode         = useCadStore((s) => s.toggleZHoldMode);

    // Local state
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showZOffsetPopover, setShowZOffsetPopover] = useState(false);
    const fileInputRef = useRef(null);

    // ---------------------------------------------------
    // GLOBAL KEYBOARD SHORTCUTS
    // ---------------------------------------------------
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault(); undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                e.preventDefault(); redo();
            } else if (e.key.toLowerCase() === 's' && !e.ctrlKey) {
                setDrawingMode('SELECT');
            } else if (e.key === '1') { setDrawingMode('FREEHAND'); }
              else if (e.key === '2') { setDrawingMode('LINE'); }
              else if (e.key === '3') { setDrawingMode('RECTANGLE'); }
              else if (e.key === '4') { setDrawingMode('CIRCLE'); }
              else if (e.key === 'Escape') { deselectObject(); clearSelectedFace(); }
              else if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelectedObject(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, setDrawingMode, deselectObject, deleteSelectedObject, clearSelectedFace]);

    // Handle JSON import
    const handleImportJSON = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.cadObjects && Array.isArray(data.cadObjects)) {
                    setCADObjects(data.cadObjects);
                    alert(`Loaded ${data.cadObjects.length} object(s).`);
                } else if (data.lines && Array.isArray(data.lines)) {
                    setCADObjects(data.lines);
                    alert(`Loaded ${data.lines.length} segment(s).`);
                } else {
                    alert('Invalid JSON: missing cadObjects array.');
                }
            } catch (_) { alert('Error parsing JSON file.'); }
        };
        reader.readAsText(file);
    };

    let totalPoints = 0;
    cadObjects.forEach((obj) => {
        if (obj.points) totalPoints += obj.points.length;
        else if (obj.start && obj.end) totalPoints += 2;
    });

    const SIDEBAR_W = sidebarOpen ? 230 : 54;

    return (
        <>
            {/* ================================================
                COLLAPSIBLE LEFT SIDEBAR
            ================================================ */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: SIDEBAR_W,
                background: 'rgba(10, 13, 22, 0.94)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid rgba(0, 240, 255, 0.18)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 30,
                transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
                overflow: 'hidden',
                pointerEvents: 'auto',
                boxShadow: '4px 0 30px rgba(0,0,0,0.5)'
            }}>
                {/* ---- SIDEBAR HEADER ---- */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: sidebarOpen ? 'space-between' : 'center',
                    padding: sidebarOpen ? '14px 14px 10px' : '14px 0 10px',
                    borderBottom: '1px solid rgba(0,240,255,0.12)',
                    flexShrink: 0
                }}>
                    {sidebarOpen && (
                        <span style={{
                            color: '#00f0ff',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '1.5px',
                            whiteSpace: 'nowrap'
                        }}>
                            CAD OPERATIONS
                        </span>
                    )}
                    <button
                        onClick={() => setSidebarOpen(o => !o)}
                        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                        style={{
                            background: 'rgba(0,240,255,0.08)',
                            border: '1px solid rgba(0,240,255,0.25)',
                            borderRadius: '8px',
                            color: '#00f0ff',
                            cursor: 'pointer',
                            padding: '5px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                    </button>
                </div>

                {/* ---- SCROLLABLE CONTENT ---- */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: sidebarOpen ? '8px 10px' : '8px 5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>

                    {/* === SECTION: DRAW TOOLS === */}
                    <SidebarSection label="Draw Tools" open={sidebarOpen}>
                        <SidebarBtn
                            icon={<MousePointer size={15} />}
                            label="Select"
                            shortcut="S"
                            active={drawingMode === 'SELECT'}
                            open={sidebarOpen}
                            onClick={() => setDrawingMode('SELECT')}
                            activeColor="#00f0ff"
                        />
                        <SidebarBtn
                            icon={<Pencil size={15} />}
                            label="Freehand"
                            shortcut="1"
                            active={drawingMode === 'FREEHAND'}
                            open={sidebarOpen}
                            onClick={() => setDrawingMode('FREEHAND')}
                        />
                        <SidebarBtn
                            icon={<Minus size={15} />}
                            label="Line"
                            shortcut="2"
                            active={drawingMode === 'LINE'}
                            open={sidebarOpen}
                            onClick={() => setDrawingMode('LINE')}
                        />
                        <SidebarBtn
                            icon={<Square size={15} />}
                            label="Rectangle"
                            shortcut="3"
                            active={drawingMode === 'RECTANGLE'}
                            open={sidebarOpen}
                            onClick={() => setDrawingMode('RECTANGLE')}
                        />
                        <SidebarBtn
                            icon={<Circle size={15} />}
                            label="Circle"
                            shortcut="4"
                            active={drawingMode === 'CIRCLE'}
                            open={sidebarOpen}
                            onClick={() => setDrawingMode('CIRCLE')}
                        />
                    </SidebarSection>

                    <SidebarDivider />

                    {/* === SECTION: 3D OPERATIONS === */}
                    <SidebarSection label="3D Operations" open={sidebarOpen}>
                        <SidebarBtn
                            icon={<Box size={15} />}
                            label="Extrude Solid"
                            active={false}
                            open={sidebarOpen}
                            onClick={() => extrudeObject(selectedObjectId, 1.5)}
                            disabled={!selectedObjectId}
                            activeColor="#00ff66"
                            accentColor="#00ff66"
                            title="Extrude selected sketch into 3D solid"
                        />
                        <SidebarBtn
                            icon={<ArrowUpDown size={15} />}
                            label="Z-Hold Mode"
                            active={zHoldModeEnabled}
                            open={sidebarOpen}
                            onClick={toggleZHoldMode}
                            activeColor="#ffaa00"
                            title="Drag object to elongate along Z"
                        />
                        <SidebarBtn
                            icon={<Trash2 size={15} />}
                            label="Delete"
                            shortcut="Del"
                            active={false}
                            open={sidebarOpen}
                            onClick={deleteSelectedObject}
                            disabled={!selectedObjectId}
                            accentColor="#ff4455"
                            title="Delete selected object"
                        />
                    </SidebarSection>

                    <SidebarDivider />

                    {/* === SECTION: SNAPPING === */}
                    <SidebarSection label="Snapping" open={sidebarOpen}>
                        <SidebarBtn
                            icon={<Magnet size={15} />}
                            label="Magnetic Snap"
                            active={magneticLockEnabled}
                            open={sidebarOpen}
                            onClick={toggleMagneticLock}
                            activeColor="#00c6ff"
                        />
                        <SidebarBtn
                            icon={<Grid size={15} />}
                            label="Grid Snap"
                            active={gridSnapEnabled}
                            open={sidebarOpen}
                            onClick={toggleGridSnap}
                            activeColor="#00ff66"
                        />
                        <SidebarBtn
                            icon={<CornerDownRight size={15} />}
                            label="45° Angle Snap"
                            active={angleSnapEnabled}
                            open={sidebarOpen}
                            onClick={toggleAngleSnap}
                            activeColor="#ffea00"
                        />
                    </SidebarSection>

                    <SidebarDivider />

                    {/* === SECTION: HISTORY === */}
                    <SidebarSection label="History" open={sidebarOpen}>
                        <SidebarBtn
                            icon={<RotateCcw size={15} />}
                            label="Undo"
                            shortcut="Ctrl+Z"
                            active={false}
                            open={sidebarOpen}
                            onClick={undo}
                            disabled={!canUndo}
                        />
                        <SidebarBtn
                            icon={<RotateCw size={15} />}
                            label="Redo"
                            shortcut="Ctrl+Y"
                            active={false}
                            open={sidebarOpen}
                            onClick={redo}
                            disabled={!canRedo}
                        />
                        <SidebarBtn
                            icon={<Trash2 size={15} />}
                            label="Clear All"
                            active={false}
                            open={sidebarOpen}
                            onClick={clearCADObjects}
                            disabled={cadObjects.length === 0}
                            accentColor="#ff4455"
                            title="Remove all CAD objects"
                        />
                    </SidebarSection>

                    <SidebarDivider />

                    {/* === SECTION: EXPORT === */}
                    <SidebarSection label="Export / Import" open={sidebarOpen}>
                        <SidebarBtn
                            icon={<Box size={15} />}
                            label="Export OBJ"
                            active={false}
                            open={sidebarOpen}
                            onClick={() => exportToOBJ(cadObjects, planeRotation)}
                            accentColor="#00ffff"
                        />
                        <SidebarBtn
                            icon={<Layers size={15} />}
                            label="Export DXF"
                            active={false}
                            open={sidebarOpen}
                            onClick={() => exportToDXF(cadObjects)}
                            accentColor="#00ff66"
                        />
                        <SidebarBtn
                            icon={<FileCode size={15} />}
                            label="Export JSON"
                            active={false}
                            open={sidebarOpen}
                            onClick={() => exportToJSON(cadObjects, planeRotation)}
                            accentColor="#ffea00"
                        />
                        <SidebarBtn
                            icon={<Camera size={15} />}
                            label="Screenshot PNG"
                            active={false}
                            open={sidebarOpen}
                            onClick={() => exportSnapshotPNG()}
                            accentColor="#ff44aa"
                        />
                        <SidebarBtn
                            icon={<Upload size={15} />}
                            label="Import JSON"
                            active={false}
                            open={sidebarOpen}
                            onClick={() => fileInputRef.current?.click()}
                        />
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImportJSON}
                            accept=".json"
                            style={{ display: 'none' }}
                        />
                    </SidebarSection>

                    <SidebarDivider />

                    {/* === SECTION: DIAGNOSTICS === */}
                    <SidebarSection label="Diagnostics" open={sidebarOpen}>
                        <SidebarBtn
                            icon={<Activity size={15} />}
                            label="Perf HUD"
                            active={diagnosticsEnabled}
                            open={sidebarOpen}
                            onClick={toggleDiagnostics}
                            activeColor="#00f0ff"
                        />
                    </SidebarSection>
                </div>

                {/* ---- SIDEBAR FOOTER: object count ---- */}
                {sidebarOpen && (
                    <div style={{
                        padding: '10px 14px',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        fontSize: '11px',
                        color: '#888',
                        fontFamily: 'monospace',
                        flexShrink: 0
                    }}>
                        <span style={{ color: '#00f0ff', fontWeight: '700' }}>{cadObjects.length}</span> objects
                        &nbsp;·&nbsp;
                        <span style={{ color: '#555' }}>{totalPoints} pts</span>
                        {selectedObjectId && (
                            <div style={{ marginTop: '4px', color: '#ffaa00', fontSize: '10px' }}>
                                ● Object selected
                            </div>
                        )}
                        {selectedFace && (
                            <div style={{ marginTop: '4px', color: '#00ffcc', fontSize: '10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                ▣ Face: <strong>{selectedFace.faceLabel}</strong>
                                <button onClick={clearSelectedFace} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 10, padding: 0, marginLeft: 4 }}>✕</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ================================================
                STATUS PANEL (TOP LEFT, offset by sidebar)
            ================================================ */}
            <div style={{
                position: 'absolute',
                top: 16,
                left: SIDEBAR_W + 16,
                color: 'white',
                background: 'rgba(10, 13, 22, 0.88)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                padding: '12px 16px',
                borderRadius: '12px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                pointerEvents: 'auto',
                zIndex: 10,
                fontSize: '11px',
                lineHeight: '1.7',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)'
            }}>
                <div style={{ color: '#00f0ff', fontWeight: '700', letterSpacing: '1px', marginBottom: '6px', fontSize: '11px' }}>
                    3D CAD STATUS
                </div>
                <div><span style={{ color: '#666' }}>Plane:</span> <span style={{ color: '#00ffff', fontWeight: '700' }}>
                    {activePreset}{activePreset === 'XY' && planePosition[2] !== 0 ? ` Z=${planePosition[2] > 0 ? '+' : ''}${planePosition[2]}` : ''}
                </span></div>
                <div><span style={{ color: '#666' }}>Tool:</span> <span style={{ color: '#ffea00', fontWeight: '700' }}>{drawingMode}</span></div>
                <div><span style={{ color: '#666' }}>Lock:</span> <span style={{ color: planeLocked ? '#ff4455' : '#00ff66', fontWeight: '700' }}>{planeLocked ? 'LOCKED' : 'FREE'}</span></div>
                <div><span style={{ color: '#666' }}>Snap:</span> <span style={{ color: isSnapped ? '#00ff66' : '#555', fontWeight: '700' }}>{isSnapped ? '🧲 SNAPPED' : magneticLockEnabled ? 'Active' : 'Off'}</span></div>
                {zHoldModeEnabled && (
                    <div style={{ marginTop: '4px', padding: '4px 8px', background: 'rgba(255,170,0,0.12)', border: '1px solid rgba(255,170,0,0.3)', borderRadius: '6px', color: '#ffaa00', fontSize: '10px' }}>
                        ↕ Z-HOLD ACTIVE
                    </div>
                )}
                {isSnapped && snappedPoint && (
                    <div style={{ marginTop: '4px', color: '#00ff66', fontSize: '10px' }}>
                        [{snappedPoint[0].toFixed(2)}, {snappedPoint[1].toFixed(2)}, {snappedPoint[2].toFixed(2)}]
                    </div>
                )}
            </div>

            {/* ================================================
                3D PLANE SELECTOR BAR (BOTTOM CENTER)
            ================================================ */}
            <div style={{
                position: 'absolute',
                bottom: 24,
                left: `calc(50% + ${SIDEBAR_W / 2}px)`,
                transform: 'translateX(-50%)',
                background: 'rgba(10, 13, 22, 0.92)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                borderRadius: '30px',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 20,
                boxShadow: '0 10px 40px rgba(0,240,255,0.2)',
                transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
                pointerEvents: 'auto',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00f0ff', fontSize: '12px', fontWeight: 'bold' }}>
                    <Compass size={16} />
                    <span>3D PLANE:</span>
                </div>

                <button onClick={() => { setPresetPlane('XY'); setShowZOffsetPopover(false); }}
                    title="XY Plane (Normal = Z)" style={presetBtnStyle(activePreset === 'XY' && planePosition[2] === 0)}>XY</button>

                {/* XY + Z Offset */}
                <button
                    id="btn-xy-offset-z"
                    onClick={() => {
                        const t = planePosition[2] !== 0 ? planePosition[2] : 2;
                        startDrawingXYWithZOffset(t);
                        setShowZOffsetPopover((p) => !p || activePreset !== 'XY');
                    }}
                    title="XY Plane with Z offset"
                    style={{
                        ...presetBtnStyle(activePreset === 'XY' && planePosition[2] !== 0),
                        background: (activePreset === 'XY' && planePosition[2] !== 0)
                            ? 'linear-gradient(135deg, rgba(0,240,255,0.4), rgba(0,114,255,0.5))'
                            : 'rgba(0,240,255,0.1)',
                        border: (activePreset === 'XY' && planePosition[2] !== 0) ? '1px solid #00f0ff' : '1px solid rgba(0,240,255,0.3)',
                        color: '#66d9ff',
                        display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                >
                    <Layers size={13} />
                    <span>XY+Z</span>
                    <span style={{
                        background: (activePreset === 'XY' && planePosition[2] !== 0) ? 'rgba(0,240,255,0.3)' : 'rgba(255,255,255,0.1)',
                        padding: '1px 6px', borderRadius: '10px', fontSize: '10px', color: '#00ffff', fontWeight: 'bold'
                    }}>
                        {planePosition[2] !== 0 ? (planePosition[2] > 0 ? `+${planePosition[2]}` : planePosition[2]) : 'Offset'}
                    </span>
                </button>

                <button onClick={() => setPresetPlane('YZ')} title="YZ Plane (Normal = X)" style={presetBtnStyle(activePreset === 'YZ')}>YZ</button>
                <button onClick={() => setPresetPlane('XZ')} title="XZ Plane (Normal = Y)" style={presetBtnStyle(activePreset === 'XZ')}>XZ</button>
                <button onClick={() => setPresetPlane('ISO')} title="Isometric 3D View" style={presetBtnStyle(activePreset === 'ISO')}>ISO (3D)</button>

                <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.2)' }} />

                {/* Axis offset stepper */}
                {['X', 'Y', 'Z'].map((axis, i) => {
                    const axisColors = ['#ff5555', '#00ff66', '#3399ff'];
                    const val = planePosition[i];
                    return (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span style={{ fontSize: '11px', color: axisColors[i], fontWeight: 'bold' }}>{axis}:</span>
                            <button onClick={() => setPlaneOffset(axis, val - 1)} style={{ ...miniBtn, padding: '5px 8px' }}>-1</button>
                            <span
                                style={{ fontSize: '11px', minWidth: '20px', textAlign: 'center', color: val !== 0 ? '#00f0ff' : '#fff', fontWeight: '700', cursor: axis === 'Z' ? 'pointer' : 'default' }}
                                onClick={axis === 'Z' ? () => { if (activePreset !== 'XY') setPresetPlane('XY'); setShowZOffsetPopover(true); } : undefined}
                            >{val}</span>
                            <button onClick={() => setPlaneOffset(axis, val + 1)} style={{ ...miniBtn, padding: '5px 8px' }}>+1</button>
                        </div>
                    );
                })}

                <button
                    onClick={() => { setPlaneOffset('X', 0); setPlaneOffset('Y', 0); setPlaneOffset('Z', 0); setShowZOffsetPopover(false); }}
                    title="Reset to origin"
                    style={{ ...miniBtn, color: '#00f0ff', borderColor: 'rgba(0,240,255,0.3)', padding: '5px 10px', fontSize: '10px' }}
                >Reset</button>

                <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.2)' }} />

                {/* Axis legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: '700', background: 'rgba(0,0,0,0.35)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {[['#ff4444','X'], ['#00e676','Y'], ['#2979ff','Z']].map(([c, l]) => (
                        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '3px', color: c }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c, display: 'inline-block', boxShadow: `0 0 5px ${c}` }} />
                            {l}
                        </span>
                    ))}
                </div>
            </div>

            {/* ================================================
                XY PLANE Z-OFFSET FLOATING CONTROLLER
            ================================================ */}
            {showZOffsetPopover && (
                <div style={{
                    position: 'absolute',
                    bottom: 84,
                    left: `calc(50% + ${SIDEBAR_W / 2}px)`,
                    transform: 'translateX(-50%)',
                    background: 'rgba(10, 15, 28, 0.97)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(0,240,255,0.45)',
                    borderRadius: '20px',
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    zIndex: 25,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 24px rgba(0,240,255,0.25)',
                    minWidth: '340px',
                    pointerEvents: 'auto'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#00f0ff', fontSize: '13px', fontWeight: 'bold' }}>
                            <Layers size={16} />
                            <span>XY PLANE: Z-AXIS OFFSET</span>
                        </div>
                        <button onClick={() => setShowZOffsetPopover(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>
                        Set elevation along the <strong style={{ color: '#3399ff' }}>Z Axis</strong>:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={() => startDrawingXYWithZOffset(planePosition[2] - 1)} style={{ ...miniBtn, padding: '5px 9px' }}>-1</button>
                        <button onClick={() => startDrawingXYWithZOffset(Math.round((planePosition[2] - 0.5) * 10) / 10)} style={{ ...miniBtn, padding: '5px 7px', fontSize: '10px' }}>-0.5</button>
                        <input
                            type="number" step="0.5" value={planePosition[2]}
                            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) startDrawingXYWithZOffset(v); }}
                            style={{ width: '70px', padding: '5px 8px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,240,255,0.5)', borderRadius: '8px', color: '#00f0ff', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', outline: 'none' }}
                        />
                        <button onClick={() => startDrawingXYWithZOffset(Math.round((planePosition[2] + 0.5) * 10) / 10)} style={{ ...miniBtn, padding: '5px 7px', fontSize: '10px' }}>+0.5</button>
                        <button onClick={() => startDrawingXYWithZOffset(planePosition[2] + 1)} style={{ ...miniBtn, padding: '5px 9px' }}>+1</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#888' }}>Quick:</span>
                        {[1, 2, 3, 5].map((v) => (
                            <button key={v} onClick={() => startDrawingXYWithZOffset(v)} style={{ ...miniBtn, padding: '4px 9px', fontSize: '11px', background: planePosition[2] === v ? 'rgba(0,240,255,0.25)' : 'rgba(255,255,255,0.05)', borderColor: planePosition[2] === v ? '#00f0ff' : 'rgba(255,255,255,0.12)', color: planePosition[2] === v ? '#00f0ff' : '#ccc' }}>+{v}</button>
                        ))}
                        <button onClick={() => startDrawingXYWithZOffset(0)} style={{ ...miniBtn, padding: '4px 9px', fontSize: '11px', color: '#888' }}>0</button>
                    </div>
                    <button
                        onClick={() => { startDrawingXYWithZOffset(planePosition[2] !== 0 ? planePosition[2] : 2); setShowZOffsetPopover(false); }}
                        style={{ background: 'linear-gradient(135deg, #00c6ff, #0072ff)', border: 'none', borderRadius: '10px', color: '#fff', padding: '9px 14px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', boxShadow: '0 4px 16px rgba(0,114,255,0.45)' }}
                    >
                        <Pencil size={14} />
                        <span>Draw on XY (Z = {planePosition[2] > 0 ? `+${planePosition[2]}` : planePosition[2]})</span>
                    </button>
                </div>
            )}
        </>
    );
}

// ============================================================
// SIDEBAR SUB-COMPONENTS
// ============================================================

function SidebarSection({ label, open, children }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {open && (
                <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', color: '#444', textTransform: 'uppercase', padding: '4px 6px 2px', fontFamily: 'monospace' }}>
                    {label}
                </div>
            )}
            {children}
        </div>
    );
}

function SidebarDivider() {
    return <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />;
}

function SidebarBtn({ icon, label, shortcut, active, open, onClick, disabled, activeColor = '#00f0ff', accentColor, title }) {
    const color = active ? activeColor : (accentColor || '#aaa');
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title || (open ? undefined : label + (shortcut ? ` [${shortcut}]` : ''))}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: open ? '9px' : '0',
                justifyContent: open ? 'flex-start' : 'center',
                padding: open ? '8px 10px' : '9px',
                borderRadius: '10px',
                border: active ? `1px solid ${activeColor}44` : '1px solid transparent',
                background: active
                    ? `linear-gradient(135deg, ${activeColor}22, ${activeColor}0a)`
                    : 'transparent',
                color: disabled ? '#333' : color,
                fontSize: '12px',
                fontWeight: active ? '700' : '500',
                cursor: disabled ? 'not-allowed' : 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                boxShadow: active ? `0 0 10px ${activeColor}22` : 'none',
                opacity: disabled ? 0.35 : 1
            }}
            onMouseEnter={(e) => { if (!disabled && !active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
        >
            <span style={{ flexShrink: 0, color: disabled ? '#333' : color }}>{icon}</span>
            {open && (
                <>
                    <span style={{ flex: 1, color: disabled ? '#333' : active ? activeColor : '#ddd' }}>{label}</span>
                    {shortcut && <span style={{ fontSize: '9px', color: '#444', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>{shortcut}</span>}
                </>
            )}
        </button>
    );
}

// ============================================================
// STYLE CONSTANTS
// ============================================================

const miniBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#ccc',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
};

const presetBtnStyle = (active) => ({
    padding: '6px 13px',
    borderRadius: '16px',
    border: active ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'linear-gradient(135deg, #00f0ff, #0072ff)' : 'rgba(255,255,255,0.04)',
    color: active ? '#ffffff' : '#ccc',
    fontWeight: 'bold',
    fontSize: '11px',
    cursor: 'pointer',
    boxShadow: active ? '0 0 12px rgba(0,240,255,0.4)' : 'none',
    transition: 'all 0.2s ease'
});
