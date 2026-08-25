/**
 * Viewport.jsx - 3D CAD Canvas and Interaction Scene Root
 */

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { WorkingPlane } from './WorkingPlane';
import { GeometryRenderer } from './GeometryRenderer';
import { PerformanceOverlay } from './PerformanceOverlay';
import { useGestureInteraction } from '../hooks/useGestureInteraction';
import { useCadStore } from '../store/useCadStore';

function Scene({ interactionRefBridge }) {
    const interaction = useGestureInteraction();
    
    // Pass interaction refs out to parent for UI overlays
    if (interactionRefBridge) {
        interactionRefBridge.current = interaction;
    }

    const planeRotation = useCadStore((state) => state.planeRotation);
    const planePosition = useCadStore((state) => state.planePosition);

    // Track viewport rendering FPS in useFrame loop
    const frameCountRef = useRef(0);
    const lastFpsCalcRef = useRef(performance.now());

    useFrame(() => {
        frameCountRef.current++;
        const now = performance.now();
        if (now - lastFpsCalcRef.current >= 1000) {
            if (interaction.diagnosticsRef?.current) {
                interaction.diagnosticsRef.current.renderFps = frameCountRef.current;
            }
            frameCountRef.current = 0;
            lastFpsCalcRef.current = now;
        }
    });

    return (
        <>
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 15, 10]} intensity={1.2} />

            {/* Active Drawing Working Plane (Oriented & Positioned in 3D Space) */}
            <group position={planePosition} rotation={planeRotation}>
                <WorkingPlane />
            </group>

            {/* 3D CAD Geometry & Active Interaction Elements in 3D World Space */}
            <GeometryRenderer 
                cursorPosRef={interaction.cursorPosRef}
                snapInfoRef={interaction.snapInfoRef}
                activeDrawingRef={interaction.activeDrawingRef}
                drawingPointsRef={interaction.drawingPointsRef}
            />
        </>
    );
}

export function Viewport() {
    const interactionRefBridge = useRef(null);

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f', position: 'relative' }}>
            <Canvas 
                camera={{ position: [6, 6, 6], fov: 50 }}
                gl={{ preserveDrawingBuffer: true, antialias: true }}
            >
                <Scene interactionRefBridge={interactionRefBridge} />
                <OrbitControls makeDefault />
            </Canvas>

            {/* Real-Time Performance Diagnostics HUD */}
            <PerformanceOverlay diagnosticsRef={interactionRefBridge.current?.diagnosticsRef} />
        </div>
    );
}
