/**
 * RevolveSettingsPanel.jsx - Professional CAD Revolve / Lathe Operation Controller
 *
 * Provides precision controls for revolving a 2D planar sketch profile around an axis:
 * 1. Step-by-step workflow: Profile Selection -> Axis Selection -> Revolution Settings
 * 2. Axis options: Centerline / Left Edge, Right Edge, Work-Plane Z, Work-Plane X, Custom Line
 * 3. Revolution angle: 1° to 360° with slider, numeric input, and quick presets (90°, 180°, 270°, 360°)
 * 4. Direction toggle (CW / CCW) and Solid / Surface mode toggles
 * 5. Real-time preview toggle and live error validation banner
 * 6. Commit / Cancel actions with keyboard shortcut (Escape)
 */

import React, { useMemo } from 'react';
import { useCadStore } from '../store/useCadStore';
import { 
    RotateCw, 
    RotateCcw, 
    Check, 
    X, 
    Sliders, 
    Eye, 
    EyeOff, 
    AlertTriangle, 
    Layers, 
    Box, 
    Compass, 
    CornerDownRight, 
    Info 
} from 'lucide-react';

const PANEL_BG = 'rgba(10, 13, 24, 0.95)';
const BORDER_COL = 'rgba(0, 240, 255, 0.35)';
const ACCENT = '#00f0ff';
const GREEN = '#00ff66';
const ORANGE = '#ffaa00';
const RED = '#ff4455';

export function RevolveSettingsPanel() {
    const revolveState = useCadStore((s) => s.revolveState);
    const cadObjects = useCadStore((s) => s.cadObjects);
    const selectedObjectId = useCadStore((s) => s.selectedObjectId);
    const detectedProfiles = useCadStore((s) => s.detectedProfiles);

    const setRevolveProfile = useCadStore((s) => s.setRevolveProfile);
    const setRevolveAxis = useCadStore((s) => s.setRevolveAxis);
    const setRevolveAngle = useCadStore((s) => s.setRevolveAngle);
    const setRevolveSurface = useCadStore((s) => s.setRevolveSurface);
    const toggleRevolveDirection = useCadStore((s) => s.toggleRevolveDirection);
    const toggleRevolvePreview = useCadStore((s) => s.toggleRevolvePreview);
    const commitRevolve = useCadStore((s) => s.commitRevolve);
    const cancelRevolveMode = useCadStore((s) => s.cancelRevolveMode);

    const step            = revolveState?.step;
    const selectedProfileId = revolveState?.selectedProfileId;
    const selectedAxis   = revolveState?.selectedAxis;
    const angleDeg       = revolveState?.angleDeg;
    const isSurface      = revolveState?.isSurface;
    const reversed       = revolveState?.reversed;
    const previewEnabled = revolveState?.previewEnabled;
    const errorMessage   = revolveState?.errorMessage;

    // Always call hooks unconditionally (Rules of Hooks)
    const selectedProfile = useMemo(() => {
        // selectedProfileId is a SketchProfile id
        return detectedProfiles.find((p) => p.id === selectedProfileId) ?? null;
    }, [detectedProfiles, selectedProfileId]);

    // Candidate profiles: always use detected profiles
    // Fall back to wrapping individual raw objects only if no profiles detected
    const candidateProfiles = useMemo(() => {
        if (detectedProfiles.length > 0) return detectedProfiles;
        // Fallback: raw objects (single-segment drawings)
        return cadObjects.filter((o) =>
            o.type !== 'REVOLVE_SOLID' &&
            o.type !== 'REVOLVE_SURFACE' &&
            (!o.extrudeHeight || o.extrudeHeight <= 0.01) &&
            (!o.operation || o.operation !== 'REVOLVE')
        );
    }, [detectedProfiles, cadObjects]);

    // Available candidate line axes in the scene
    const candidateLines = useMemo(() => {
        return cadObjects.filter((o) => o.type === 'LINE' && o.id !== selectedProfileId);
    }, [cadObjects, selectedProfileId]);

    if (!revolveState || !revolveState.active) {
        return null;
    }

    const isAxisPreset = typeof selectedAxis === 'string';

    return (
        <div style={{
            position: 'absolute',
            top: '72px',
            right: '20px',
            width: '320px',
            background: PANEL_BG,
            backdropFilter: 'blur(12px)',
            border: `1px solid ${BORDER_COL}`,
            borderRadius: '10px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.75), 0 0 16px rgba(0, 240, 255, 0.15)',
            color: '#e0f7fa',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            zIndex: 900,
            overflow: 'hidden',
            userSelect: 'none'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'rgba(0, 240, 255, 0.08)',
                borderBottom: `1px solid ${BORDER_COL}`
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: 'rgba(0, 240, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: ACCENT
                    }}>
                        <RotateCw size={15} />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.5px', color: '#fff' }}>
                            REVOLVE (LATHE)
                        </div>
                        <div style={{ fontSize: '10px', color: '#80deea' }}>
                            3D Rotational Solid Modeling
                        </div>
                    </div>
                </div>

                <button
                    onClick={cancelRevolveMode}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#80deea',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Cancel Revolve (Esc)"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Workflow Step Tracker */}
            <div style={{
                display: 'flex',
                background: 'rgba(5, 8, 16, 0.6)',
                borderBottom: '1px solid rgba(0, 240, 255, 0.15)',
                fontSize: '10px',
                padding: '6px 10px',
                gap: '4px',
                justifyContent: 'space-between'
            }}>
                <div style={{
                    color: selectedProfileId ? GREEN : ACCENT,
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span>1. Profile</span>
                    {selectedProfileId && <Check size={11} color={GREEN} />}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
                <div style={{
                    color: selectedAxis ? GREEN : (selectedProfileId ? ACCENT : '#607d8b'),
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span>2. Axis</span>
                    {selectedAxis && <Check size={11} color={GREEN} />}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
                <div style={{
                    color: selectedProfileId && selectedAxis ? ACCENT : '#607d8b',
                    fontWeight: 'bold'
                }}>
                    3. Settings
                </div>
            </div>

            {/* Error / Warning Alert Banner */}
            {errorMessage && (
                <div style={{
                    padding: '8px 12px',
                    background: 'rgba(255, 68, 85, 0.15)',
                    borderBottom: '1px solid rgba(255, 68, 85, 0.4)',
                    color: '#ff8899',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    lineHeight: '1.4'
                }}>
                    <AlertTriangle size={15} color={RED} style={{ flexShrink: 0 }} />
                    <div>{errorMessage}</div>
                </div>
            )}

            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* ---------------- SECTION 1: PROFILE SELECTION ---------------- */}
                <div>
                    <div style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        color: '#80deea',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>Cross-Sectional Profile</span>
                        <span style={{ fontSize: '10px', color: selectedProfile ? GREEN : ORANGE }}>
                            {selectedProfile ? (selectedProfile.type || 'Profile') : 'Click / Pinch to Pick'}
                        </span>
                    </div>

                    {candidateProfiles.length === 0 ? (
                        <div style={{
                            padding: '8px',
                            background: 'rgba(255, 170, 0, 0.08)',
                            border: '1px dashed rgba(255, 170, 0, 0.3)',
                            borderRadius: '6px',
                            fontSize: '11px',
                            color: '#ffcc80'
                        }}>
                            No 2D sketch profile found. Draw connected lines/curves first.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <select
                                value={selectedProfileId || ''}
                                onChange={(e) => setRevolveProfile(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    border: `1px solid ${selectedProfileId ? 'rgba(0, 255, 102, 0.4)' : BORDER_COL}`,
                                    borderRadius: '6px',
                                    color: selectedProfileId ? '#fff' : '#80deea',
                                    fontSize: '11px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="" disabled>-- Select a 2D Profile --</option>
                                {candidateProfiles.map((p, idx) => (
                                    <option key={p.id} value={p.id}>
                                        {detectedProfiles.length > 0
                                            ? p.label   // SketchProfile label e.g. "PROFILE (6 segments, Closed)"
                                            : `[${p.type || 'SKETCH'}] #${idx + 1} (${p.points?.length || 2} pts)`}
                                    </option>
                                ))}
                            </select>

                            {/* Show validation warnings for the selected profile */}
                            {selectedProfile?.validation?.warnings?.length > 0 && (
                                <div style={{
                                    padding: '5px 8px',
                                    background: 'rgba(255, 170, 0, 0.1)',
                                    border: '1px solid rgba(255, 170, 0, 0.3)',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    color: '#ffcc80'
                                }}>
                                    ⚠ {selectedProfile.validation.warnings[0]}
                                </div>
                            )}

                            <div style={{ fontSize: '10px', color: '#607d8b', paddingLeft: '2px' }}>
                                {detectedProfiles.length > 0
                                    ? 'Connected segments are auto-grouped into profiles.'
                                    : 'Tip: You can also click directly on any segment in the viewport.'}
                            </div>
                        </div>
                    )}
                </div>

                {/* ---------------- SECTION 2: AXIS OF REVOLUTION ---------------- */}
                <div>
                    <div style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        color: '#80deea',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>Axis of Revolution</span>
                        <button
                            onClick={toggleRevolveDirection}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(0, 240, 255, 0.3)',
                                borderRadius: '4px',
                                color: ACCENT,
                                fontSize: '10px',
                                padding: '1px 6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                cursor: 'pointer'
                            }}
                            title="Reverse Revolution Direction"
                        >
                            {reversed ? <RotateCcw size={10} /> : <RotateCw size={10} />}
                            {reversed ? 'Reversed (CCW)' : 'Normal (CW)'}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <button
                            onClick={() => setRevolveAxis('PROFILE_LEFT')}
                            style={{
                                padding: '6px 8px',
                                background: selectedAxis === 'PROFILE_LEFT' ? 'rgba(0, 240, 255, 0.22)' : 'rgba(15, 23, 42, 0.7)',
                                border: `1px solid ${selectedAxis === 'PROFILE_LEFT' ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '6px',
                                color: selectedAxis === 'PROFILE_LEFT' ? '#fff' : '#b0bec5',
                                fontSize: '11px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Compass size={12} color={selectedAxis === 'PROFILE_LEFT' ? ACCENT : '#90a4ae'} />
                            <span>Left Edge (Center)</span>
                        </button>

                        <button
                            onClick={() => setRevolveAxis('PROFILE_RIGHT')}
                            style={{
                                padding: '6px 8px',
                                background: selectedAxis === 'PROFILE_RIGHT' ? 'rgba(0, 240, 255, 0.22)' : 'rgba(15, 23, 42, 0.7)',
                                border: `1px solid ${selectedAxis === 'PROFILE_RIGHT' ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '6px',
                                color: selectedAxis === 'PROFILE_RIGHT' ? '#fff' : '#b0bec5',
                                fontSize: '11px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Compass size={12} color={selectedAxis === 'PROFILE_RIGHT' ? ACCENT : '#90a4ae'} />
                            <span>Right Edge</span>
                        </button>

                        <button
                            onClick={() => setRevolveAxis('AXIS_Z')}
                            style={{
                                padding: '6px 8px',
                                background: selectedAxis === 'AXIS_Z' ? 'rgba(0, 240, 255, 0.22)' : 'rgba(15, 23, 42, 0.7)',
                                border: `1px solid ${selectedAxis === 'AXIS_Z' ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '6px',
                                color: selectedAxis === 'AXIS_Z' ? '#fff' : '#b0bec5',
                                fontSize: '11px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Compass size={12} color={selectedAxis === 'AXIS_Z' ? ACCENT : '#90a4ae'} />
                            <span>Work-Plane Z</span>
                        </button>

                        <button
                            onClick={() => setRevolveAxis('AXIS_X')}
                            style={{
                                padding: '6px 8px',
                                background: selectedAxis === 'AXIS_X' ? 'rgba(0, 240, 255, 0.22)' : 'rgba(15, 23, 42, 0.7)',
                                border: `1px solid ${selectedAxis === 'AXIS_X' ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '6px',
                                color: selectedAxis === 'AXIS_X' ? '#fff' : '#b0bec5',
                                fontSize: '11px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Compass size={12} color={selectedAxis === 'AXIS_X' ? ACCENT : '#90a4ae'} />
                            <span>Work-Plane X</span>
                        </button>
                    </div>

                    {/* Custom line from sketch as axis */}
                    {candidateLines.length > 0 && (
                        <div style={{ marginTop: '6px' }}>
                            <select
                                value={typeof selectedAxis === 'object' && selectedAxis.lineId ? selectedAxis.lineId : ''}
                                onChange={(e) => {
                                    const lObj = candidateLines.find((l) => l.id === e.target.value);
                                    if (lObj) {
                                        setRevolveAxis({
                                            type: 'LINE',
                                            lineId: lObj.id,
                                            points: lObj.points || [lObj.start, lObj.end]
                                        });
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    padding: '5px 8px',
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    border: '1px solid rgba(0, 240, 255, 0.25)',
                                    borderRadius: '6px',
                                    color: typeof selectedAxis === 'object' ? '#fff' : '#80deea',
                                    fontSize: '11px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="">-- Or Pick an In-Plane Sketch Line --</option>
                                {candidateLines.map((l, i) => (
                                    <option key={l.id} value={l.id}>
                                        {`Line #${i + 1} (${l.id.substr(0, 8)})`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* ---------------- SECTION 3: REVOLUTION ANGLE ---------------- */}
                <div>
                    <div style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        color: '#80deea',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>Revolution Angle</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                                type="number"
                                min="1"
                                max="360"
                                step="1"
                                value={angleDeg}
                                onChange={(e) => setRevolveAngle(e.target.value)}
                                style={{
                                    width: '54px',
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    border: `1px solid ${BORDER_COL}`,
                                    borderRadius: '4px',
                                    color: ACCENT,
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    padding: '2px 4px',
                                    outline: 'none'
                                }}
                            />
                            <span style={{ fontSize: '11px', color: ACCENT, fontWeight: 'bold' }}>°</span>
                        </div>
                    </div>

                    <input
                        type="range"
                        min="1"
                        max="360"
                        step="1"
                        value={angleDeg}
                        onChange={(e) => setRevolveAngle(e.target.value)}
                        style={{
                            width: '100%',
                            accentColor: ACCENT,
                            cursor: 'pointer',
                            margin: '4px 0'
                        }}
                    />

                    {/* Quick angle presets */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '4px' }}>
                        {[90, 180, 270, 360].map((deg) => (
                            <button
                                key={deg}
                                onClick={() => setRevolveAngle(deg)}
                                style={{
                                    padding: '4px 0',
                                    background: angleDeg === deg ? 'rgba(0, 240, 255, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                                    border: `1px solid ${angleDeg === deg ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: '4px',
                                    color: angleDeg === deg ? '#fff' : '#90a4ae',
                                    fontSize: '10px',
                                    fontWeight: angleDeg === deg ? 'bold' : 'normal',
                                    cursor: 'pointer'
                                }}
                            >
                                {deg}°
                            </button>
                        ))}
                    </div>
                </div>

                {/* ---------------- SECTION 4: SOLID VS SURFACE MODE & PREVIEW ---------------- */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: '#b0bec5'
                    }}>
                        <input
                            type="checkbox"
                            checked={isSurface}
                            onChange={(e) => setRevolveSurface(e.target.checked)}
                            style={{ accentColor: ACCENT, cursor: 'pointer' }}
                        />
                        <span>Surface Mode (Open)</span>
                    </label>

                    <button
                        onClick={toggleRevolvePreview}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: previewEnabled ? ACCENT : '#607d8b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px'
                        }}
                        title="Toggle Live 3D Preview"
                    >
                        {previewEnabled ? <Eye size={13} /> : <EyeOff size={13} />}
                        <span>{previewEnabled ? 'Preview On' : 'Preview Off'}</span>
                    </button>
                </div>

                {/* ---------------- SECTION 5: ACTION BUTTONS ---------------- */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                        onClick={cancelRevolveMode}
                        style={{
                            flex: 1,
                            padding: '8px 0',
                            background: 'rgba(255, 68, 85, 0.1)',
                            border: '1px solid rgba(255, 68, 85, 0.3)',
                            borderRadius: '6px',
                            color: '#ff8899',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <X size={14} />
                        Cancel
                    </button>

                    <button
                        onClick={commitRevolve}
                        disabled={!selectedProfileId}
                        style={{
                            flex: 2,
                            padding: '8px 0',
                            background: selectedProfileId 
                                ? 'linear-gradient(135deg, rgba(0, 255, 102, 0.85), rgba(0, 200, 80, 0.95))' 
                                : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${selectedProfileId ? GREEN : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '6px',
                            color: selectedProfileId ? '#05180f' : '#607d8b',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: selectedProfileId ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: selectedProfileId ? '0 4px 12px rgba(0, 255, 102, 0.3)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Check size={14} />
                        {angleDeg === 360 ? 'Revolve 360°' : `Revolve (${angleDeg}°)`}
                    </button>
                </div>
            </div>
        </div>
    );
}
