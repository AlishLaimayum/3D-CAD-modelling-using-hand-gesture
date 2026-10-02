import { useMemo } from 'react';
import { Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useCadStore } from '../store/useCadStore';

const COLOR_X = '#ff3b30'; // Red
const COLOR_Y = '#34c759'; // Green
const COLOR_Z = '#007aff'; // Blue

function PlaneAxisLine({ start, end, color }) {
    const geometry = useMemo(() => {
        const pts = [
            new THREE.Vector3(...start),
            new THREE.Vector3(...end)
        ];
        return new THREE.BufferGeometry().setFromPoints(pts);
    }, [start, end]);

    return (
        <line geometry={geometry}>
            <lineBasicMaterial color={color} linewidth={3} depthTest={false} />
        </line>
    );
}

export function WorkingPlane() {
    const activePreset = useCadStore((state) => state.activePreset);

    // Determine semantic axis assignments based on active plane preset
    // In local plane space:
    // - Local X axis is along grid horizontal
    // - Local Z axis is along grid vertical
    // - Local Y axis is normal perpendicular to grid
    const axisConfig = useMemo(() => {
        const len = 4.5;
        const normLen = 1.8;

        if (activePreset === 'XY') {
            // XY Plane:
            // Local X corresponds to World X (Red)
            // Local Z corresponds to World Y (Green)
            // Local +Y (normal) corresponds to World +Z (Blue)
            return {
                axis1: { start: [-len, 0, 0], end: [len, 0, 0], color: COLOR_X, labelPos: [len + 0.35, 0, 0], label: '+X', negPos: [-len - 0.35, 0, 0], negLabel: '-X' },
                axis2: { start: [0, 0, -len], end: [0, 0, len], color: COLOR_Y, labelPos: [0, 0, -len - 0.35], label: '+Y', negPos: [0, 0, len + 0.35], negLabel: '-Y' },
                normal: { start: [0, 0, 0], end: [0, normLen, 0], color: COLOR_Z, labelPos: [0, normLen + 0.25, 0], label: '+Z Normal' }
            };
        } else if (activePreset === 'YZ') {
            // YZ Plane:
            // Local Z corresponds to World Z (Blue)
            // Local X corresponds to World Y (Green)
            // Local +Y (normal) corresponds to World +X (Red)
            return {
                axis1: { start: [0, 0, -len], end: [0, 0, len], color: COLOR_Z, labelPos: [0, 0, len + 0.35], label: '+Z', negPos: [0, 0, -len - 0.35], negLabel: '-Z' },
                axis2: { start: [len, 0, 0], end: [-len, 0, 0], color: COLOR_Y, labelPos: [-len - 0.35, 0, 0], label: '+Y', negPos: [len + 0.35, 0, 0], negLabel: '-Y' },
                normal: { start: [0, 0, 0], end: [0, normLen, 0], color: COLOR_X, labelPos: [0, normLen + 0.25, 0], label: '+X Normal' }
            };
        } else {
            // XZ Plane / ISO / Custom:
            // Local X corresponds to World X (Red)
            // Local Z corresponds to World Z (Blue)
            // Local +Y (normal) corresponds to World +Y (Green)
            return {
                axis1: { start: [-len, 0, 0], end: [len, 0, 0], color: COLOR_X, labelPos: [len + 0.35, 0, 0], label: '+X', negPos: [-len - 0.35, 0, 0], negLabel: '-X' },
                axis2: { start: [0, 0, -len], end: [0, 0, len], color: COLOR_Z, labelPos: [0, 0, len + 0.35], label: '+Z', negPos: [0, 0, -len - 0.35], negLabel: '-Z' },
                normal: { start: [0, 0, 0], end: [0, normLen, 0], color: COLOR_Y, labelPos: [0, normLen + 0.25, 0], label: '+Y Normal' }
            };
        }
    }, [activePreset]);

    return (
        <group>
            {/* Infinite Fade Visual Grid Plane */}
            <Grid
                position={[0, 0, 0]}
                args={[1000, 1000]}
                cellSize={1}
                cellThickness={1}
                cellColor="#2a435a"
                sectionSize={0}
                sectionThickness={0}
                fadeDistance={80}
                fadeStrength={1.5}
                infiniteGrid
            />

            {/* Plane-Attached Semantic Coordinate Axes (Moves & Rotates with Plane) */}
            {axisConfig && (
                <group position={[0, 0.001, 0]}>
                    {/* Primary Axis 1 */}
                    <PlaneAxisLine start={axisConfig.axis1.start} end={axisConfig.axis1.end} color={axisConfig.axis1.color} />
                    <Text position={axisConfig.axis1.labelPos} fontSize={0.32} color={axisConfig.axis1.color} anchorX="center" anchorY="middle">
                        {axisConfig.axis1.label}
                    </Text>
                    <Text position={axisConfig.axis1.negPos} fontSize={0.22} color={axisConfig.axis1.color} opacity={0.6} anchorX="center" anchorY="middle">
                        {axisConfig.axis1.negLabel}
                    </Text>

                    {/* Primary Axis 2 */}
                    <PlaneAxisLine start={axisConfig.axis2.start} end={axisConfig.axis2.end} color={axisConfig.axis2.color} />
                    <Text position={axisConfig.axis2.labelPos} fontSize={0.32} color={axisConfig.axis2.color} anchorX="center" anchorY="middle">
                        {axisConfig.axis2.label}
                    </Text>
                    <Text position={axisConfig.axis2.negPos} fontSize={0.22} color={axisConfig.axis2.color} opacity={0.6} anchorX="center" anchorY="middle">
                        {axisConfig.axis2.negLabel}
                    </Text>

                    {/* Normal Axis (Sticking Perpendicular out of the plane) */}
                    <PlaneAxisLine start={axisConfig.normal.start} end={axisConfig.normal.end} color={axisConfig.normal.color} />
                    <Text position={axisConfig.normal.labelPos} fontSize={0.25} color={axisConfig.normal.color} anchorX="center" anchorY="middle">
                        {axisConfig.normal.label}
                    </Text>
                </group>
            )}
        </group>
    );
}