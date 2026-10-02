/**
 * Viewport.jsx - 3D CAD Canvas and Interaction Scene Root
 */

import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { WorkingPlane } from './WorkingPlane';
import { GeometryRenderer } from './GeometryRenderer';
import { PerformanceOverlay } from './PerformanceOverlay';
import { useGestureInteraction } from '../hooks/useGestureInteraction';
import { useZElongation } from '../hooks/useZElongation';
import { useCadStore } from '../store/useCadStore';

function CameraController({ controlsRef }) {
    const { camera } = useThree();
    const cameraTargetPosition = useCadStore((state) => state.cameraTargetPosition);
    const cameraTargetUp = useCadStore((state) => state.cameraTargetUp);
    const planePosition = useCadStore((state) => state.planePosition);
    const targetCamVec = useRef(new THREE.Vector3());
    const targetLookAt = useRef(new THREE.Vector3());
    const targetUpVec = useRef(new THREE.Vector3(0, 1, 0));
    const isAnimating = useRef(false);

    useEffect(() => {
        if (!cameraTargetPosition) return;
        targetCamVec.current.set(...cameraTargetPosition);
        targetLookAt.current.set(...planePosition);
        if (cameraTargetUp) {
            targetUpVec.current.set(...cameraTargetUp);
        }
        isAnimating.current = true;
    }, [cameraTargetPosition, cameraTargetUp, planePosition]);

    useFrame((_, delta) => {
        if (!isAnimating.current) return;

        // Smooth camera damping towards target
        const lerpFactor = Math.min(1, delta * 9);
        camera.position.lerp(targetCamVec.current, lerpFactor);
        camera.up.lerp(targetUpVec.current, lerpFactor);

        if (controlsRef.current) {
            controlsRef.current.target.lerp(targetLookAt.current, lerpFactor);
            controlsRef.current.update();
        }

        if (camera.position.distanceTo(targetCamVec.current) < 0.02) {
            camera.position.copy(targetCamVec.current);
            camera.up.copy(targetUpVec.current);
            if (controlsRef.current) {
                controlsRef.current.target.copy(targetLookAt.current);
                controlsRef.current.update();
            }
            isAnimating.current = false;
        }
    });

    return null;
}

function Scene({ interactionRefBridge, controlsRef }) {
    // Z-Elongation HOLD mode — mounts pointer/gesture listeners when active
    const zElongation = useZElongation(controlsRef);
    const interaction = useGestureInteraction(zElongation);
    
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

            <CameraController controlsRef={controlsRef} />

            {/* Dynamic Drawing Plane: Grid, Plane Axes, Cursor, and Geometry Move with Active Plane */}
            <group position={planePosition} rotation={planeRotation}>
                <WorkingPlane />
                <GeometryRenderer 
                    cursorPosRef={interaction.cursorPosRef}
                    snapInfoRef={interaction.snapInfoRef}
                    activeDrawingRef={interaction.activeDrawingRef}
                    drawingPointsRef={interaction.drawingPointsRef}
                />
            </group>
        </>
    );
}

export function Viewport() {
    const interactionRefBridge = useRef(null);
    const controlsRef = useRef(null);

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f', position: 'relative' }}>
            <Canvas 
                camera={{ position: [6, 6, 6], fov: 50 }}
                gl={{ preserveDrawingBuffer: true, antialias: true }}
            >
                <Scene interactionRefBridge={interactionRefBridge} controlsRef={controlsRef} />
                <OrbitControls ref={controlsRef} makeDefault />
            </Canvas>

            {/* Real-Time Performance Diagnostics HUD */}
            <PerformanceOverlay diagnosticsRef={interactionRefBridge.current?.diagnosticsRef} />
        </div>
    );
}
