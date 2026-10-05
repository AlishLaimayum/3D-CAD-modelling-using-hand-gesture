/**
 * SurfaceSelectionPanel.jsx
 *
 * A floating right-side panel that shows when a 3D solid is selected.
 * Lists all named faces of the solid. Clicking a face item selects it and
 * activates a face-attached drawing plane.
 */

import { useMemo } from 'react';
import { useCadStore } from '../store/useCadStore';
import { enumerateFaces } from '../cad/geometry/FaceEnumerator';

/* ------------------------------------------------------------------ */
/* Colour palette                                                       */
/* ------------------------------------------------------------------ */
const PANEL_BG   = 'rgba(10,12,24,0.92)';
const BORDER_COL = 'rgba(0,240,255,0.25)';
const ACCENT     = '#00ffcc';
const TEXT_DIM   = 'rgba(180,220,255,0.55)';

/* Face-type icon characters */
const FACE_ICONS = {
    Top:    '⬆',
    Bottom: '⬇',
    Front:  '🔲',
    Back:   '🔲',
    Left:   '◀',
    Right:  '▶',
    Side:   '⟳',
};

function faceIcon(label) {
    return FACE_ICONS[label] || '▪';
}

function normalStr(n) {
    const fmt = (v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
    return `(${fmt(n[0])}, ${fmt(n[1])}, ${fmt(n[2])})`;
}

export function SurfaceSelectionPanel() {
    const selectedObjectId = useCadStore((s) => s.selectedObjectId);
    const selectedFace     = useCadStore((s) => s.selectedFace);
    const drawingMode      = useCadStore((s) => s.drawingMode);
    const cadObjects       = useCadStore((s) => s.cadObjects);
    const setSelectedFace  = useCadStore((s) => s.setSelectedFace);
    const clearSelectedFace= useCadStore((s) => s.clearSelectedFace);
    const setDrawingMode   = useCadStore((s) => s.setDrawingMode);

    const obj = useMemo(
        () => cadObjects.find((o) => o.id === selectedObjectId),
        [cadObjects, selectedObjectId]
    );

    const faces = useMemo(() => {
        if (!obj) return [];
        return enumerateFaces(obj);
    }, [obj]);

    // Only show the panel when a 3D solid is selected
    if (!obj || !obj.extrudeHeight || obj.extrudeHeight < 0.01 || faces.length === 0) {
        return null;
    }

    const handleFaceClick = (face) => {
        setSelectedFace({
            objectId:  obj.id,
            faceLabel: face.label,
            position:  face.position,
            normal:    face.normal,
            tangent:   face.tangent,
            bitangent: face.bitangent,
        });
    };

    const handleStartDrawing = (toolMode) => {
        if (!selectedFace) return;
        setDrawingMode(toolMode);
    };

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            right: '16px',
            transform: 'translateY(-50%)',
            zIndex: 9000,
            width: '200px',
            background: PANEL_BG,
            border: `1px solid ${BORDER_COL}`,
            borderRadius: '12px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 14px 8px',
                borderBottom: `1px solid ${BORDER_COL}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <span style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Surface Selection
                </span>
                <button
                    onClick={clearSelectedFace}
                    title="Clear face selection"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: TEXT_DIM,
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: 0,
                        lineHeight: 1,
                    }}
                >✕</button>
            </div>

            {/* Object info */}
            <div style={{ padding: '6px 14px', borderBottom: `1px solid ${BORDER_COL}` }}>
                <div style={{ fontSize: 10, color: TEXT_DIM }}>
                    {obj.type || 'SOLID'} · h={obj.extrudeHeight?.toFixed(2)}
                </div>
            </div>

            {/* Face list */}
            <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {faces.map((face) => {
                    const isSel = selectedFace?.objectId === obj.id && selectedFace?.faceLabel === face.label;
                    return (
                        <button
                            key={face.label}
                            onClick={() => handleFaceClick(face)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 10px',
                                borderRadius: 7,
                                border: isSel
                                    ? `1px solid ${ACCENT}`
                                    : '1px solid rgba(0,240,255,0.1)',
                                background: isSel
                                    ? 'rgba(0,255,204,0.12)'
                                    : 'rgba(255,255,255,0.03)',
                                color: isSel ? ACCENT : 'rgba(200,230,255,0.8)',
                                cursor: 'pointer',
                                fontSize: 12,
                                textAlign: 'left',
                                transition: 'all 0.15s',
                                fontFamily: 'inherit',
                            }}
                        >
                            <span style={{ fontSize: 14, width: 18 }}>{faceIcon(face.label)}</span>
                            <span style={{ flex: 1 }}>{face.label}</span>
                            {isSel && (
                                <span style={{ fontSize: 9, background: ACCENT, color: '#000', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>
                                    ACTIVE
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Selected face info */}
            {selectedFace && selectedFace.objectId === obj.id && (() => {
                const sf = faces.find((f) => f.label === selectedFace.faceLabel);
                if (!sf) return null;
                return (
                    <div style={{ borderTop: `1px solid ${BORDER_COL}`, padding: '8px 14px' }}>
                        <div style={{ fontSize: 9, color: TEXT_DIM, marginBottom: 4 }}>FACE NORMAL</div>
                        <div style={{ fontSize: 10, color: ACCENT, fontFamily: 'monospace' }}>
                            {normalStr(sf.normal)}
                        </div>
                        <div style={{ fontSize: 9, color: TEXT_DIM, marginTop: 8, marginBottom: 4 }}>DRAW ON FACE</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {['LINE', 'RECTANGLE', 'CIRCLE', 'FREEHAND'].map((tool) => (
                                <button
                                    key={tool}
                                    onClick={() => handleStartDrawing(tool)}
                                    style={{
                                        flex: 1,
                                        padding: '4px 2px',
                                        fontSize: 8,
                                        background: drawingMode === tool ? ACCENT : 'rgba(0,240,255,0.08)',
                                        color: drawingMode === tool ? '#000' : ACCENT,
                                        border: `1px solid ${ACCENT}`,
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        fontWeight: 600,
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    {tool === 'FREEHAND' ? 'FREE' : tool.charAt(0) + tool.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
