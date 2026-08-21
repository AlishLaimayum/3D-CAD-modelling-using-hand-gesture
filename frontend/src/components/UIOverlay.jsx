import { useRef } from 'react';
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
    Trash2, 
    Upload, 
    Camera, 
    Box, 
    FileCode, 
    Layers,
    Compass,
    MoveUp,
    MoveDown
} from 'lucide-react';

export function UIOverlay() {
    const gestureState = useCadStore((state) => state.gestureState);
    const planeLocked = useCadStore((state) => state.planeLocked);
    const cursorPosition = useCadStore((state) => state.cursorPosition);
    const planeRotation = useCadStore((state) => state.planeRotation);
    const planePosition = useCadStore((state) => state.planePosition);
    const activePreset = useCadStore((state) => state.activePreset);
    const lines = useCadStore((state) => state.lines);
    const magneticLockEnabled = useCadStore((state) => state.magneticLockEnabled);
    const isSnapped = useCadStore((state) => state.isSnapped);
    
    const toggleMagneticLock = useCadStore((state) => state.toggleMagneticLock);
    const undoLine = useCadStore((state) => state.undoLine);
    const clearLines = useCadStore((state) => state.clearLines);
    const setLines = useCadStore((state) => state.setLines);
    const setPresetPlane = useCadStore((state) => state.setPresetPlane);
    const setPlaneOffset = useCadStore((state) => state.setPlaneOffset);

    const fileInputRef = useRef(null);

    const handleImportJSON = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.lines && Array.isArray(data.lines)) {
                    setLines(data.lines);
                    alert(`Loaded project with ${data.lines.length} line segment(s).`);
                } else {
                    alert('Invalid JSON structure: missing lines array.');
                }
            } catch (err) {
                alert('Error parsing JSON file.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <>
            {/* Status Panel (Top Left) */}
            <div style={{ 
                position: 'absolute', 
                top: 20, 
                left: 20, 
                color: 'white', 
                background: 'rgba(15, 18, 28, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '20px',
                borderRadius: '12px',
                fontFamily: 'monospace',
                pointerEvents: 'auto',
                zIndex: 10,
                minWidth: '260px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
                <h3 style={{
                    marginTop: 0, 
                    marginBottom: '12px',
                    borderBottom: '1px solid rgba(255,255,255,0.15)', 
                    paddingBottom: '8px',
                    color: '#00f0ff',
                    fontSize: '15px',
                    letterSpacing: '1px'
                }}>
                    3D MODELING STATUS
                </h3>
                
                <div style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>Active Plane:</strong> <span style={{ color: '#00ffff', fontWeight: 'bold' }}>{activePreset} PLANE</span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>Plane Elevation (Y):</strong> <span style={{ color: '#ffea00', fontWeight: 'bold' }}>{planePosition[1].toFixed(2)}</span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>Gesture:</strong> <span style={{ color: '#00ffff', fontWeight: 'bold' }}>{gestureState}</span>
                </div>
                
                <div style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>Plane Lock:</strong> <span style={{ color: planeLocked ? '#ff4455' : '#00ff66', fontWeight: 'bold' }}>{planeLocked ? 'LOCKED' : 'UNLOCKED'}</span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>Magnetic Snap:</strong> <span style={{ color: magneticLockEnabled ? (isSnapped ? '#00ff66' : '#ffea00') : '#888888', fontWeight: 'bold' }}>
                        {magneticLockEnabled ? (isSnapped ? 'SNAP LOCKED 🧲' : 'ACTIVE') : 'DISABLED'}
                    </span>
                </div>

                <div style={{ margin: '6px 0', fontSize: '13px' }}>
                    <strong>3D Segments:</strong> <span style={{ color: '#00ffff' }}>{lines.length}</span>
                </div>

                {cursorPosition && (
                    <div style={{ margin: '8px 0', fontSize: '12px', color: '#aaa' }}>
                        <strong>World 3D Pos:</strong><br/>
                        X: {cursorPosition[0].toFixed(2)} Y: {cursorPosition[1].toFixed(2)} Z: {cursorPosition[2].toFixed(2)}
                    </div>
                )}
            </div>

            {/* 3D Plane Selector Bar (Bottom Center) */}
            <div style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 18, 28, 0.9)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '30px',
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                zIndex: 20,
                boxShadow: '0 10px 40px rgba(0,240,255,0.2)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00f0ff', fontSize: '13px', fontWeight: 'bold', marginRight: '4px' }}>
                    <Compass size={18} />
                    <span>3D PLANE:</span>
                </div>

                {/* Top Plane */}
                <button
                    onClick={() => setPresetPlane('TOP')}
                    style={presetBtnStyle(activePreset === 'TOP')}
                >
                    TOP (XZ)
                </button>

                {/* Front Plane */}
                <button
                    onClick={() => setPresetPlane('FRONT')}
                    style={presetBtnStyle(activePreset === 'FRONT')}
                >
                    FRONT (XY)
                </button>

                {/* Side Plane */}
                <button
                    onClick={() => setPresetPlane('SIDE')}
                    style={presetBtnStyle(activePreset === 'SIDE')}
                >
                    SIDE (YZ)
                </button>

                {/* Isometric Plane */}
                <button
                    onClick={() => setPresetPlane('ISO')}
                    style={presetBtnStyle(activePreset === 'ISO')}
                >
                    ISO (45°)
                </button>

                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }} />

                {/* Elevation Controls */}
                <span style={{ fontSize: '12px', color: '#aaa', fontWeight: '600' }}>HEIGHT:</span>
                <button
                    onClick={() => setPlaneOffset(planePosition[1] + 1)}
                    title="Raise Plane Height (+1 Y)"
                    style={btnStyle}
                >
                    <MoveUp size={14} color="#00ff66" />
                    <span>+1</span>
                </button>

                <button
                    onClick={() => setPlaneOffset(planePosition[1] - 1)}
                    title="Lower Plane Height (-1 Y)"
                    style={btnStyle}
                >
                    <MoveDown size={14} color="#ffea00" />
                    <span>-1</span>
                </button>

                <button
                    onClick={() => setPlaneOffset(0)}
                    title="Reset Plane Height to 0"
                    style={{ ...btnStyle, fontSize: '11px' }}
                >
                    Reset Y=0
                </button>
            </div>

            {/* Main Action Bar (Top Center) */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 18, 28, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '30px',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 20,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}>
                {/* Magnetic Lock Button */}
                <button
                    onClick={toggleMagneticLock}
                    title="Toggle Magnetic Snap Lock (Connect close vertices)"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '20px',
                        border: 'none',
                        background: magneticLockEnabled ? 'linear-gradient(135deg, #00c6ff, #0072ff)' : '#2a2e3d',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: magneticLockEnabled ? '0 0 12px rgba(0,198,255,0.4)' : 'none'
                    }}
                >
                    <Magnet size={16} />
                    <span>Magnet Lock: {magneticLockEnabled ? 'ON' : 'OFF'}</span>
                </button>

                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }} />

                {/* Exporters */}
                <button
                    onClick={() => exportToOBJ(lines, planeRotation)}
                    title="Export Wavefront 3D OBJ file"
                    style={btnStyle}
                >
                    <Box size={16} color="#00ffff" />
                    <span>OBJ</span>
                </button>

                <button
                    onClick={() => exportToDXF(lines)}
                    title="Export AutoCAD DXF file"
                    style={btnStyle}
                >
                    <Layers size={16} color="#00ff66" />
                    <span>DXF</span>
                </button>

                <button
                    onClick={() => exportToJSON(lines, planeRotation)}
                    title="Export CAD Project JSON"
                    style={btnStyle}
                >
                    <FileCode size={16} color="#ffea00" />
                    <span>JSON</span>
                </button>

                <button
                    onClick={() => exportSnapshotPNG()}
                    title="Download 3D Viewport PNG Snapshot"
                    style={btnStyle}
                >
                    <Camera size={16} color="#ff44aa" />
                    <span>PNG</span>
                </button>

                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }} />

                {/* Import */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Load JSON Project"
                    style={btnStyle}
                >
                    <Upload size={16} />
                    <span>Load</span>
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImportJSON} 
                    accept=".json" 
                    style={{ display: 'none' }} 
                />

                {/* Undo & Clear */}
                <button
                    onClick={undoLine}
                    disabled={lines.length === 0}
                    title="Undo last line segment"
                    style={{ ...btnStyle, opacity: lines.length === 0 ? 0.4 : 1 }}
                >
                    <RotateCcw size={16} />
                </button>

                <button
                    onClick={clearLines}
                    disabled={lines.length === 0}
                    title="Clear all lines"
                    style={{ ...btnStyle, background: 'rgba(255,68,85,0.2)', color: '#ff4455', opacity: lines.length === 0 ? 0.4 : 1 }}
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Instruction Panel (Top Right) */}
            <div style={{ 
                position: 'absolute', 
                top: 20, 
                right: 20, 
                color: 'white', 
                background: 'rgba(15, 18, 28, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '20px',
                borderRadius: '12px',
                fontFamily: 'sans-serif',
                pointerEvents: 'auto',
                zIndex: 10,
                width: '300px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
                <h3 style={{
                    marginTop: 0, 
                    marginBottom: '12px',
                    borderBottom: '1px solid rgba(255,255,255,0.15)', 
                    paddingBottom: '8px',
                    fontFamily: 'monospace',
                    color: '#00f0ff',
                    fontSize: '15px',
                    letterSpacing: '1px'
                }}>
                    3D MODELING GUIDE
                </h3>
                
                <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                    Select a 3D Plane preset (Top, Front, Side, ISO) or swipe with Open Palm to sketch across multiple 3D planes to construct 3D wireframe models!
                </p>

                {/* Mouse Draw */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ width: '32px', height: '32px', marginRight: '10px', background: '#1e2436', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '16px' }}>🖱️</span>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#00ffff', fontSize: '12px' }}>MOUSE DRAW</strong>
                        <span style={{ fontSize: '11px', color: '#aaa' }}>Click & Drag to draw lines on active 3D plane.</span>
                    </div>
                </div>

                {/* Open Palm */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ width: '32px', height: '32px', marginRight: '10px', background: '#1e2436', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V3a2 2 0 0 0-4 0v9"/><path d="M18 11.5v2.27c0 .86-.3 1.7-.85 2.36l-4.25 5.11A2 2 0 0 1 11.37 22H8.5a4 4 0 0 1-3.92-3.23l-.7-3.5a2 2 0 0 1 1.04-2.18l2.9-1.45a1.99 1.99 0 0 1 2.18.25V9"/>
                        </svg>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#00ffff', fontSize: '12px' }}>OPEN PALM</strong>
                        <span style={{ fontSize: '11px', color: '#aaa' }}>Swipe gesture to rotate active 3D plane.</span>
                    </div>
                </div>

                {/* Pinch */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', marginRight: '10px', background: '#1e2436', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffea00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="2" fill="#ffea00"/><path d="M12 2L12 10"/><path d="M12 14L12 22"/><path d="M2 12L10 12"/><path d="M14 12L22 12"/>
                        </svg>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#ffea00', fontSize: '12px' }}>PINCH GESTURE</strong>
                        <span style={{ fontSize: '11px', color: '#aaa' }}>Pinch gesture to draw 3D lines.</span>
                    </div>
                </div>
            </div>
        </>
    );
}

const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '8px 12px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#1a1f2c',
    color: '#eee',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
};

const presetBtnStyle = (active) => ({
    padding: '6px 14px',
    borderRadius: '16px',
    border: active ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.15)',
    background: active ? 'linear-gradient(135deg, #00f0ff, #0072ff)' : '#1a1f2c',
    color: active ? '#ffffff' : '#ccc',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: active ? '0 0 12px rgba(0,240,255,0.5)' : 'none',
    transition: 'all 0.2s ease'
});
