/**
 * CursorRenderer.jsx - High-Frequency Direct 3D Cursor & Snap Indicator
 * 
 * Bypasses React state cycles by reading `cursorPosRef` and `snapInfoRef`
 * directly inside `useFrame()`, moving Three.js meshes at 60+ FPS with zero React rerenders.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCadStore } from '../store/useCadStore';

export function CursorRenderer({ cursorPosRef, snapInfoRef }) {
    const cursorGroupRef = useRef();
    const sphereMeshRef = useRef();
    const snapRingMeshRef = useRef();

    // Read low-frequency gesture/lock state using granular selectors
    const gestureState = useCadStore((state) => state.gestureState);
    const planeLocked = useCadStore((state) => state.planeLocked);

    // Preallocated color instances to prevent garbage collection
    const colorIdle = useRef(new THREE.Color('#00f0ff')).current;
    const colorPinch = useRef(new THREE.Color('#ff0055')).current;
    const colorSnapped = useRef(new THREE.Color('#00ff66')).current;
    const colorLocked = useRef(new THREE.Color('#ffaa00')).current;

    useFrame(() => {
        if (!cursorGroupRef.current) return;

        const pos = cursorPosRef?.current;
        if (!pos) {
            cursorGroupRef.current.visible = false;
            return;
        }

        // Direct position update
        cursorGroupRef.current.visible = true;
        cursorGroupRef.current.position.set(pos[0], pos[1], pos[2]);

        const snapInfo = snapInfoRef?.current;
        const isSnapped = snapInfo?.isSnapped;

        // Dynamic visual update on sphere material
        if (sphereMeshRef.current) {
            const material = sphereMeshRef.current.material;
            if (isSnapped) {
                material.color.copy(colorSnapped);
                sphereMeshRef.current.scale.setScalar(1.3);
            } else if (gestureState === 'PINCH' || gestureState === 'DRAWING') {
                material.color.copy(colorPinch);
                sphereMeshRef.current.scale.setScalar(1.1);
            } else if (planeLocked) {
                material.color.copy(colorLocked);
                sphereMeshRef.current.scale.setScalar(1.0);
            } else {
                material.color.copy(colorIdle);
                sphereMeshRef.current.scale.setScalar(1.0);
            }
        }

        // Snap target indicator ring
        if (snapRingMeshRef.current) {
            snapRingMeshRef.current.visible = !!isSnapped;
        }
    });

    return (
        <group ref={cursorGroupRef} visible={false}>
            {/* Core 3D Cursor Sphere */}
            <mesh ref={sphereMeshRef}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial color="#00f0ff" />
            </mesh>

            {/* Magnetic Lock Halo / Snap Indicator Ring */}
            <mesh ref={snapRingMeshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
                <ringGeometry args={[0.06, 0.12, 32]} />
                <meshBasicMaterial color="#00ff66" side={THREE.DoubleSide} transparent opacity={0.8} />
            </mesh>
        </group>
    );
}
