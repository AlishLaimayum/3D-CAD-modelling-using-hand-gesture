/**
 * FaceHighlightOverlay.jsx
 *
 * Renders clickable, highlightable face overlays on a selected 3D solid so the
 * user can pick a face directly in the 3D viewport.
 *
 * Each face is represented by an interactive click-target mesh whose geometry
 * comes from the actual object vertices for that face region.
 * The selected face shows a glowing teal translucent fill + bright outline.
 *
 * Does NOT modify object geometry.
 */

import { useState, useMemo } from 'react';
import * as THREE from 'three';
import { useCadStore } from '../store/useCadStore';
import { enumerateFaces, getObjectMatrix } from '../cad/geometry/FaceEnumerator';

/** Build a flat polygon mesh (filled) from an array of THREE.Vector3 world-space vertices */
function buildFilledMesh(verts) {
    if (!verts || verts.length < 3) return null;
    const positions = [];
    // Fan triangulation from vertex 0
    for (let i = 1; i < verts.length - 1; i++) {
        positions.push(verts[0].x, verts[0].y, verts[0].z);
        positions.push(verts[i].x, verts[i].y, verts[i].z);
        positions.push(verts[i + 1].x, verts[i + 1].y, verts[i + 1].z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
}

/** Build a line loop (outline) from an array of THREE.Vector3 world-space vertices */
function buildOutlineMesh(verts) {
    if (!verts || verts.length < 2) return null;
    const looped = [...verts, verts[0]];
    return new THREE.BufferGeometry().setFromPoints(looped);
}

/** Build full 3D cylindrical sleeve geometry + outlines for the curved side of a cylinder */
function buildCylinderSideGeometry(obj) {
    const pts = obj.points || [];
    const h = obj.extrudeHeight || 0;
    const matrix = getObjectMatrix(obj);
    const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(matrix);

    const positions = [];
    const N = pts.length;
    if (N < 3) return { filled: null, outline: null };

    for (let i = 0; i < N; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % N];
        const w0_b = toWorld(p0[0], 0, p0[2]);
        const w1_b = toWorld(p1[0], 0, p1[2]);
        const w0_t = toWorld(p0[0], h, p0[2]);
        const w1_t = toWorld(p1[0], h, p1[2]);

        positions.push(w0_b.x, w0_b.y, w0_b.z);
        positions.push(w1_b.x, w1_b.y, w1_b.z);
        positions.push(w1_t.x, w1_t.y, w1_t.z);

        positions.push(w0_b.x, w0_b.y, w0_b.z);
        positions.push(w1_t.x, w1_t.y, w1_t.z);
        positions.push(w0_t.x, w0_t.y, w0_t.z);
    }

    const filled = new THREE.BufferGeometry();
    filled.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    filled.computeVertexNormals();

    const outlinePts = [];
    for (let i = 0; i < N; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % N];
        outlinePts.push(toWorld(p0[0], h, p0[2]), toWorld(p1[0], h, p1[2]));
        outlinePts.push(toWorld(p0[0], 0, p0[2]), toWorld(p1[0], 0, p1[2]));
    }
    const step = Math.max(1, Math.floor(N / 4));
    for (let k = 0; k < 4; k++) {
        const p = pts[k * step];
        outlinePts.push(toWorld(p[0], 0, p[2]), toWorld(p[0], h, p[2]));
    }
    const outline = new THREE.BufferGeometry().setFromPoints(outlinePts);

    return { filled, outline };
}

/**
 * Get the world-space polygon vertices that describe a given face of a solid.
 */
function getFaceVerts(obj, faceLabel) {
    const pts = obj.points || [];
    const h = obj.extrudeHeight || 0;
    const matrix = getObjectMatrix(obj);
    const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(matrix);

    if (faceLabel === 'Top') {
        return pts.map(p => toWorld(p[0], h, p[2]));
    }

    if (faceLabel === 'Bottom') {
        return [...pts].reverse().map(p => toWorld(p[0], 0, p[2]));
    }

    // Box side faces (Front, Back, Left, Right)
    if (obj.type === 'RECTANGLE' && pts.length >= 4) {
        const corners = pts.slice(0, 4);
        const labelMap = { Front: 2, Back: 0, Left: 3, Right: 1 };
        const i = labelMap[faceLabel] ?? 0;
        const j = (i + 1) % 4;
        const a = corners[i], b = corners[j];
        return [
            toWorld(a[0], 0, a[2]), toWorld(b[0], 0, b[2]),
            toWorld(b[0], h, b[2]), toWorld(a[0], h, a[2]),
        ];
    }

    // Generic polygon side
    if (pts.length >= 2) {
        const a = pts[0], b = pts[1];
        return [
            toWorld(a[0], 0, a[2]), toWorld(b[0], 0, b[2]),
            toWorld(b[0], h, b[2]), toWorld(a[0], h, a[2]),
        ];
    }
    return [];
}

/** One face click target + highlight */
function FaceMesh({ obj, face, isSelected, onClick }) {
    const [hovered, setHovered] = useState(false);

    const { filled, outline } = useMemo(() => {
        if (obj.type === 'CIRCLE' && face.label === 'Side') {
            return buildCylinderSideGeometry(obj);
        }
        const verts = getFaceVerts(obj, face.label);
        return {
            filled:  buildFilledMesh(verts),
            outline: buildOutlineMesh(verts),
        };
    }, [obj, face.label]);

    if (!filled) return null;

    const showHighlight = isSelected || hovered;

    return (
        <group>
            {/* Click target and translucent fill */}
            <mesh
                geometry={filled}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick(face);
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                }}
                renderOrder={999}
            >
                <meshBasicMaterial
                    color={isSelected ? '#00ffcc' : (hovered ? '#00e5ff' : '#88ffee')}
                    transparent
                    opacity={isSelected ? 0.32 : (hovered ? 0.15 : 0.001)}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Glowing outline when face is selected or hovered */}
            {showHighlight && outline && (
                <line geometry={outline} renderOrder={1000}>
                    <lineBasicMaterial
                        color={isSelected ? '#00ffcc' : '#00e5ff'}
                        linewidth={isSelected ? 2 : 1}
                        depthTest={false}
                        transparent
                        opacity={isSelected ? 0.95 : 0.6}
                    />
                </line>
            )}
        </group>
    );
}

export function FaceHighlightOverlay() {
    const selectedObjectId = useCadStore((s) => s.selectedObjectId);
    const selectedFace     = useCadStore((s) => s.selectedFace);
    const cadObjects       = useCadStore((s) => s.cadObjects);
    const setSelectedFace  = useCadStore((s) => s.setSelectedFace);

    const obj = useMemo(
        () => cadObjects.find((o) => o.id === selectedObjectId),
        [cadObjects, selectedObjectId]
    );

    const faces = useMemo(() => {
        if (!obj) return [];
        return enumerateFaces(obj);
    }, [obj]);

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

    return (
        <group>
            {faces.map((face) => {
                const isSel = selectedFace?.objectId === obj.id
                           && selectedFace?.faceLabel === face.label;
                return (
                    <FaceMesh
                        key={face.label}
                        obj={obj}
                        face={face}
                        isSelected={isSel}
                        onClick={handleFaceClick}
                    />
                );
            })}
        </group>
    );
}
