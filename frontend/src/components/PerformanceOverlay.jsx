/**
 * PerformanceOverlay.jsx - Real-Time Performance & Interaction Diagnostics HUD
 * 
 * Displays live tracking metrics:
 * - Tracking Input FPS (from WebSocket packet arrival rate)
 * - Viewport Render FPS (from R3F useFrame)
 * - WebSocket Transport Latency (ms)
 * - Current Gesture State & State Machine Mode
 * - Active Drawing Point Count (live during drawing)
 * - Completed CAD Object Count & Total Coordinates Stored
 * - Snapping & Precision Lock State
 */

import { useState, useEffect } from 'react';
import { useCadStore } from '../store/useCadStore';

export function PerformanceOverlay({ diagnosticsRef }) {
    const diagnosticsEnabled = useCadStore((state) => state.diagnosticsEnabled);
    const toggleDiagnostics = useCadStore((state) => state.toggleDiagnostics);
    const cadObjects = useCadStore((state) => state.cadObjects);
    const drawingMode = useCadStore((state) => state.drawingMode);
    const isSnapped = useCadStore((state) => state.isSnapped);
    const gestureState = useCadStore((state) => state.gestureState);

    const [stats, setStats] = useState({
        inputFps: 0,
        renderFps: 60,
        wsLatency: 0,
        activePoints: 0
    });

    // Keyboard shortcut (Press 'D' or 'F2' to toggle diagnostics)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'd' || e.key === 'D' || e.key === 'F2') {
                toggleDiagnostics();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleDiagnostics]);

    // Update diagnostic stats at ~5 Hz interval to prevent UI overhead
    useEffect(() => {
        if (!diagnosticsEnabled) return;

        const interval = setInterval(() => {
            const diag = diagnosticsRef?.current;
            if (diag) {
                setStats({
                    inputFps: diag.inputFps || 0,
                    renderFps: diag.renderFps || 60,
                    wsLatency: diag.wsLatency || 0,
                    activePoints: diag.activePointCount || 0
                });
            }
        }, 200);

        return () => clearInterval(interval);
    }, [diagnosticsEnabled, diagnosticsRef]);

    if (!diagnosticsEnabled) return null;

    // Calculate total stored points across all CAD objects
    let totalPointsStored = 0;
    cadObjects.forEach((obj) => {
        if (obj.points) totalPointsStored += obj.points.length;
        else if (obj.start && obj.end) totalPointsStored += 2;
    });

    return (
        <div style={{
            position: 'absolute',
            bottom: 80,
            left: 20,
            background: 'rgba(10, 14, 23, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            borderRadius: '12px',
            padding: '16px 20px',
            color: '#e0e6ed',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '12px',
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0, 240, 255, 0.15)',
            minWidth: '240px',
            pointerEvents: 'auto',
            userSelect: 'none'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                paddingBottom: '8px',
                marginBottom: '10px'
            }}>
                <span style={{ color: '#00f0ff', fontWeight: 'bold', letterSpacing: '1px' }}>
                    ⚡ DIAGNOSTICS HUD
                </span>
                <span style={{ color: '#888', fontSize: '10px' }}>[D / F2]</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: '6px', columnGap: '12px' }}>
                <span style={{ color: '#aaa' }}>Tracking Input:</span>
                <span style={{ color: stats.inputFps > 20 ? '#00ff66' : '#ffea00', fontWeight: 'bold' }}>
                    {stats.inputFps} FPS
                </span>

                <span style={{ color: '#aaa' }}>Viewport Render:</span>
                <span style={{ color: stats.renderFps > 45 ? '#00ff66' : '#ffea00', fontWeight: 'bold' }}>
                    {stats.renderFps} FPS
                </span>

                <span style={{ color: '#aaa' }}>WS Transport Latency:</span>
                <span style={{ color: stats.wsLatency < 35 ? '#00ff66' : (stats.wsLatency < 80 ? '#ffea00' : '#ff4455'), fontWeight: 'bold' }}>
                    {stats.wsLatency > 0 ? `${stats.wsLatency} ms` : '< 1 ms'}
                </span>

                <span style={{ color: '#aaa' }}>Gesture State:</span>
                <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
                    {gestureState}
                </span>

                <span style={{ color: '#aaa' }}>Drawing Mode:</span>
                <span style={{ color: '#ffea00', fontWeight: 'bold' }}>
                    {drawingMode}
                </span>

                <span style={{ color: '#aaa' }}>Active Stroke Points:</span>
                <span style={{ color: stats.activePoints > 0 ? '#ff0055' : '#888', fontWeight: 'bold' }}>
                    {stats.activePoints} pts
                </span>

                <span style={{ color: '#aaa' }}>CAD Objects Count:</span>
                <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
                    {cadObjects.length}
                </span>

                <span style={{ color: '#aaa' }}>Total Points Stored:</span>
                <span style={{ color: '#00ff66', fontWeight: 'bold' }}>
                    {totalPointsStored}
                </span>

                <span style={{ color: '#aaa' }}>Precision Snap:</span>
                <span style={{ color: isSnapped ? '#00ff66' : '#888', fontWeight: 'bold' }}>
                    {isSnapped ? 'LOCKED 🧲' : 'SEARCHING'}
                </span>
            </div>
        </div>
    );
}
