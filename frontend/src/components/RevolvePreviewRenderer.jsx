/**
 * RevolvePreviewRenderer.jsx - Real-Time 3D Translucent Revolve / Lathe Preview
 *
 * Renders in the active sketch's local coordinate frame:
 * 1. Translucent preview mesh of the rotational solid
 * 2. Glowing feature edge wireframes
 * 3. Prominently highlighted axis of revolution with direction indicator
 * 4. High-visibility highlighted 2D cross-section profile boundary
 * 5. Bounding box & live volume badge
 */

import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useCadStore } from '../store/useCadStore';
import { RevolveEngine } from '../cad/geometry/RevolveEngine.js';
import { Profile2D } from '../cad/geometry/Profile2D.js';

export function RevolvePreviewRenderer() {
    const revolveState     = useCadStore((s) => s.revolveState);
    const cadObjects       = useCadStore((s) => s.cadObjects);
    const detectedProfiles = useCadStore((s) => s.detectedProfiles);
    const planePosition    = useCadStore((s) => s.planePosition);
    const planeRotation    = useCadStore((s) => s.planeRotation);

    // Read fields with optional chaining so hooks below are always called safely
    const selectedProfileId = revolveState?.selectedProfileId ?? null;
    const selectedAxis  = revolveState?.selectedAxis ?? 'PROFILE_LEFT';
    const angleDeg      = revolveState?.angleDeg ?? 360;
    const isSurface     = revolveState?.isSurface ?? false;
    const reversed      = revolveState?.reversed ?? false;

    // ── All hooks must be called unconditionally (Rules of Hooks) ──

    // Resolve: SketchProfile (merged) or raw CAD object
    const sketchProf = useMemo(() => {
        if (!selectedProfileId) return null;
        return detectedProfiles.find(p => p.id === selectedProfileId) ?? null;
    }, [detectedProfiles, selectedProfileId]);

    const profileObj = useMemo(() => {
        if (!selectedProfileId || sketchProf) return null;
        return cadObjects.find((o) => o.id === selectedProfileId) ?? null;
    }, [cadObjects, selectedProfileId, sketchProf]);

    // Plane position/rotation from whichever source we have
    const pos = sketchProf?.planePosition ?? profileObj?.planePosition ?? planePosition;
    const rot = sketchProf?.planeRotation ?? profileObj?.planeRotation ?? planeRotation;

    const prof = useMemo(() => {
        if (sketchProf) {
            return new Profile2D({
                points:   sketchProf.points,
                type:     'FREEHAND',
                isClosed: sketchProf.isClosed
            });
        }
        if (!profileObj) return null;
        return profileObj.profile || new Profile2D({
            points: profileObj.points || (profileObj.start && profileObj.end ? [profileObj.start, profileObj.end] : []),
            type: profileObj.type || 'FREEHAND',
            isClosed: !isSurface
        });
    }, [sketchProf, profileObj, isSurface]);

    // Resolved axis definition in local plane space
    const axisDef = useMemo(() => {
        if (!prof) return { a0: [0, 0, 0], dir: [0, 0, 1], label: 'Axis' };
        try {
            return RevolveEngine.resolveAxis(selectedAxis, prof);
        } catch (e) {
            return { a0: [0, 0, 0], dir: [0, 0, 1], label: 'Axis' };
        }
    }, [selectedAxis, prof]);

    // Generate real-time preview SolidMesh
    const previewSolidMesh = useMemo(() => {
        if (!prof) return null;
        try {
            return RevolveEngine.revolve(prof, selectedAxis, angleDeg, isSurface, reversed);
        } catch (err) {
            console.warn('Revolve preview generation error:', err);
            return null;
        }
    }, [prof, selectedAxis, angleDeg, isSurface, reversed]);

    // Three.js BufferGeometry for the revolved solid preview
    const previewGeometry = useMemo(() => {
        if (!previewSolidMesh) return null;
        return previewSolidMesh.toThreeGeometry();
    }, [previewSolidMesh]);

    // Crisp CAD feature edge wireframe
    const previewEdgeGeometry = useMemo(() => {
        if (!previewSolidMesh) return null;
        return previewSolidMesh.toEdgeGeometry(25);
    }, [previewSolidMesh]);

    // Axis line visual geometry extending across profile span
    const axisVisualGeometry = useMemo(() => {
        const { a0, dir } = axisDef;
        const lineLen = 12.0;
        const p1 = new THREE.Vector3(
            a0[0] - dir[0] * lineLen,
            a0[1] - dir[1] * lineLen,
            a0[2] - dir[2] * lineLen
        );
        const p2 = new THREE.Vector3(
            a0[0] + dir[0] * lineLen,
            a0[1] + dir[1] * lineLen,
            a0[2] + dir[2] * lineLen
        );
        return new THREE.BufferGeometry().setFromPoints([p1, p2]);
    }, [axisDef]);

    // Highlighted 2D Profile boundary line
    const profileOutlineGeometry = useMemo(() => {
        const pts = prof?.points || [];
        if (pts.length < 2) return null;
        const vecPoints = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
        if (prof?.isClosed && pts.length >= 3) {
            vecPoints.push(new THREE.Vector3(pts[0][0], pts[0][1], pts[0][2]));
        }
        return new THREE.BufferGeometry().setFromPoints(vecPoints);
    }, [prof]);

    // Clean up Three.js geometries on unmount / change
    useEffect(() => {
        return () => {
            previewGeometry?.dispose();
            previewEdgeGeometry?.dispose();
            axisVisualGeometry?.dispose();
            profileOutlineGeometry?.dispose();
        };
    }, [previewGeometry, previewEdgeGeometry, axisVisualGeometry, profileOutlineGeometry]);

    // ── Early returns AFTER all hooks ──
    if (!revolveState || !revolveState.active || !revolveState.previewEnabled || !selectedProfileId) {
        return null;
    }
    if (!sketchProf && !profileObj) return null;

    const bbox = previewSolidMesh?.boundingBox || { center: [0, 0, 0], max: [1, 1, 1], min: [-1, -1, -1] };
    const dims = previewSolidMesh?.dimensions || { x: 0, y: 0, z: 0 };
    const volume = previewSolidMesh?.volume || 0;

    return (
        <group position={pos} rotation={rot}>
            {/* 1. Translucent Revolve Solid Preview Mesh */}
            {previewGeometry && (
                <mesh geometry={previewGeometry}>
                    <meshStandardMaterial
                        color="#00f0ff"
                        transparent
                        opacity={0.5}
                        roughness={0.25}
                        metalness={0.15}
                        emissive="#004466"
                        emissiveIntensity={0.25}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            )}

            {/* 2. Crisp Glowing CAD Wireframe Feature Edges */}
            {previewEdgeGeometry && (
                <lineSegments geometry={previewEdgeGeometry}>
                    <lineBasicMaterial
                        color="#ffffff"
                        linewidth={2}
                        transparent
                        opacity={0.85}
                    />
                </lineSegments>
            )}

            {/* 3. Highlighted Profile Boundary (Bright Gold/Lime) */}
            {profileOutlineGeometry && (
                <line geometry={profileOutlineGeometry}>
                    <lineBasicMaterial
                        color="#ffea00"
                        linewidth={3}
                    />
                </line>
            )}

            {/* 4. Axis of Revolution: Prominent Highlighted Centerline (Orange/Amber) */}
            {axisVisualGeometry && (
                <group>
                    <line geometry={axisVisualGeometry}>
                        <lineBasicMaterial
                            color="#ff9900"
                            linewidth={3}
                            depthTest={false}
                        />
                    </line>
                    {/* Small axis label indicator in 3D */}
                    <Text
                        position={[
                            axisDef.a0[0] + axisDef.dir[0] * 3,
                            axisDef.a0[1] + axisDef.dir[1] * 3 + 0.2,
                            axisDef.a0[2] + axisDef.dir[2] * 3
                        ]}
                        fontSize={0.25}
                        color="#ffaa00"
                        anchorX="center"
                        anchorY="bottom"
                    >
                        {`AXIS: ${axisDef.label || 'Revolution Axis'}`}
                    </Text>
                </group>
            )}

            {/* 5. Live Dimension & Volume Badge during Preview */}
            {previewSolidMesh && (
                <group position={[bbox.max[0] + 0.4, bbox.center[1], bbox.center[2]]}>
                    <Text
                        fontSize={0.24}
                        color="#00ffff"
                        anchorX="left"
                        anchorY="middle"
                    >
                        {`Preview: ${angleDeg}° | V: ${volume.toFixed(1)} cm³`}
                    </Text>
                    <Text
                        position={[0, -0.3, 0]}
                        fontSize={0.2}
                        color="#80deea"
                        anchorX="left"
                        anchorY="middle"
                    >
                        {`Dims: ${dims.x.toFixed(1)} × ${dims.y.toFixed(1)} × ${dims.z.toFixed(1)} cm`}
                    </Text>
                </group>
            )}
        </group>
    );
}
