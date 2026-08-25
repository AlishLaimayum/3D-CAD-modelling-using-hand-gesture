import { useMemo } from 'react';
import { useCadStore } from '../store/useCadStore';
import * as THREE from 'three';

export function GeometryRenderer() {
    const lines = useCadStore((state) => state.lines);
    const currentLine = useCadStore((state) => state.currentLine);
    const cursorPosition = useCadStore((state) => state.cursorPosition);
    const gestureState = useCadStore((state) => state.gestureState);
    const isSnapped = useCadStore((state) => state.isSnapped);
    const snappedPoint = useCadStore((state) => state.snappedPoint);

    // Create THREE geometries efficiently
    const renderedLines = useMemo(() => {
        return lines.map((line) => {
            const points = [
                new THREE.Vector3(...line.start),
                new THREE.Vector3(...line.end)
            ];
            return new THREE.BufferGeometry().setFromPoints(points);
        });
    }, [lines]);

    const currentLineGeometry = useMemo(() => {
        if (!currentLine) return null;
        const points = [
            new THREE.Vector3(...currentLine.start),
            new THREE.Vector3(...currentLine.end)
        ];
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [currentLine]);

    return (
        <group>
            {/* Completed Line Segments */}
            {renderedLines.map((geom, idx) => (
                <primitive object={new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 3 }))} key={idx} />
            ))}

            {/* In-Progress Drawing Line */}
            {currentLine && currentLineGeometry && (
                <primitive 
                    key={`curr-${currentLine.start.join('_')}-${currentLine.end.join('_')}`}
                    object={new THREE.Line(currentLineGeometry, new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 3 }))} 
                />
            )}

            {/* 3D Cursor & Magnetic Snap Marker */}
            {cursorPosition && (
                <group position={cursorPosition}>
                    {/* Main Cursor Sphere */}
                    <mesh>
                        <sphereGeometry args={[isSnapped ? 0.12 : 0.09, 16, 16]} />
                        <meshBasicMaterial 
                            color={isSnapped ? '#00ff66' : (gestureState === 'PINCH' ? '#ff0055' : '#00f0ff')} 
                        />
                    </mesh>

                    {/* Magnetic Lock Target Ring Visual */}
                    {isSnapped && (
                        <mesh rotation={[-Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[0.05, 0.08, 32]} />
                            <meshBasicMaterial color="#00ff66" side={THREE.DoubleSide} />
                        </mesh>
                    )}
                </group>
            )}

            {/* Highlight Snapped Vertex if separate */}
            {isSnapped && snappedPoint && (
                <mesh position={snappedPoint}>
                    <sphereGeometry args={[0.09, 16, 16]} />
                    <meshBasicMaterial color="#00ff66" wireframe />
                </mesh>
            )}
        </group>
    );
}
