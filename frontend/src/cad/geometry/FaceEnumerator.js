/**
 * FaceEnumerator.js
 *
 * Given a completed CAD object (with extrudeHeight > 0), enumerate its logical
 * named faces and compute each face's world-space coordinate frame:
 *   position  - a point ON the face (centroid)
 *   normal    - outward unit normal (world-space)
 *   tangent   - first in-plane axis
 *   bitangent - second in-plane axis (right-hand basis)
 *
 * For RECTANGLE / CIRCLE extrusions (prisms / cylinders), we detect:
 *   Top, Bottom, Side (or Front/Back/Left/Right for boxes).
 *
 * The returned faces are purely descriptive — they do NOT modify geometry.
 */

import * as THREE from 'three';

const _up = new THREE.Vector3(0, 1, 0);

/**
 * Build the world-space Matrix4 for a CAD object.
 * Matches what CompletedObjectsRenderer applies: position + rotation.
 */
export function getObjectMatrix(obj) {
    const pos = obj.planePosition || [0, 0, 0];
    const rot = obj.planeRotation || [Math.PI / 2, 0, 0];
    const euler = new THREE.Euler(rot[0], rot[1], rot[2], 'XYZ');
    const quat  = new THREE.Quaternion().setFromEuler(euler);
    return new THREE.Matrix4().compose(
        new THREE.Vector3(...pos),
        quat,
        new THREE.Vector3(1, 1, 1)
    );
}

/**
 * Convert a local-space normal + position into world-space,
 * and build tangent / bitangent vectors forming an orthonormal right-handed basis:
 *   tangent x wNormal = bitangent
 */
export function makeFacePlane(label, localPos, localNormal, matrix) {
    const wPos = new THREE.Vector3(...localPos).applyMatrix4(matrix);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const wNormal = new THREE.Vector3(...localNormal).applyMatrix3(normalMatrix).normalize();

    // Pick a reference vector that isn't parallel to normal
    const reference = Math.abs(wNormal.dot(_up)) < 0.9 ? _up.clone() : new THREE.Vector3(1, 0, 0);
    // In-plane tangent: horizontal axis
    const tangent = new THREE.Vector3().crossVectors(wNormal, reference).normalize();
    // In-plane bitangent: completes right-hand basis where tangent x wNormal = bitangent
    const bitangent = new THREE.Vector3().crossVectors(tangent, wNormal).normalize();

    return {
        label,
        position:  [wPos.x,       wPos.y,       wPos.z],
        normal:    [wNormal.x,    wNormal.y,    wNormal.z],
        tangent:   [tangent.x,    tangent.y,    tangent.z],
        bitangent: [bitangent.x,  bitangent.y,  bitangent.z],
    };
}

/**
 * Convert a face descriptor into a THREE.Euler [x, y, z] representing the
 * face-attached drawing plane rotation.
 * In this plane frame:
 *   Local X = tangent (in-plane horizontal)
 *   Local Y = normal  (perpendicular outward)
 *   Local Z = bitangent (in-plane vertical)
 */
export function faceToEuler(face) {
    const normal = new THREE.Vector3(...face.normal).normalize();
    const tangent = new THREE.Vector3(...face.tangent).normalize();
    const bitangent = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    tangent.crossVectors(normal, bitangent).normalize();

    const rotMat = new THREE.Matrix4().makeBasis(tangent, normal, bitangent);
    const euler = new THREE.Euler().setFromRotationMatrix(rotMat, 'XYZ');
    return [euler.x, euler.y, euler.z];
}

/**
 * Enumerate all logical faces for a CAD object.
 * Returns an array of face descriptors, or [] if object is not a 3D solid.
 *
 * @param {Object} obj - CAD object from the store
 * @returns {Array<{label,position,normal,tangent,bitangent}>}
 */
export function enumerateFaces(obj) {
    if (!obj || !obj.extrudeHeight || obj.extrudeHeight < 0.01) return [];

    const h = obj.extrudeHeight;
    const matrix = getObjectMatrix(obj);
    const faces = [];

    // ---- TOP face ----
    // In local space: Y = h, normal = [0,1,0]
    const pts = obj.points || [];
    let cx = 0, cz = 0;
    if (pts.length > 0) {
        for (const p of pts) { cx += p[0]; cz += p[2]; }
        cx /= pts.length; cz /= pts.length;
    }

    faces.push(makeFacePlane('Top', [cx, h, cz], [0, 1, 0], matrix));

    // ---- BOTTOM face ----
    // Normal = [0,-1,0], Y = 0
    faces.push(makeFacePlane('Bottom', [cx, 0, cz], [0, -1, 0], matrix));

    // ---- SIDE face(s) ----
    if (obj.type === 'CIRCLE') {
        // Cylinder: one curved "Side" surface — representative tangent plane at +X
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const p of pts) {
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];
        }
        const r = Math.max(maxX - cx, maxZ - cz, 0.01);
        faces.push(makeFacePlane('Side', [cx + r, h / 2, cz], [1, 0, 0], matrix));
    } else if (obj.type === 'RECTANGLE' && pts.length >= 4) {
        // Box: 4 side faces (Front, Back, Left, Right)
        const corners = pts.slice(0, 4);
        const midH = h / 2;
        for (let i = 0; i < 4; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % 4];
            // Outward normal: perpendicular to edge AB, in XZ plane
            const ex = b[0] - a[0], ez = b[2] - a[2];
            const len = Math.hypot(ex, ez) || 1;
            const nx = ez / len, nz = -ex / len;
            const midX = (a[0] + b[0]) / 2;
            const midZ = (a[2] + b[2]) / 2;
            const label = getFaceLabel(i, nx, nz);
            faces.push(makeFacePlane(label, [midX, midH, midZ], [nx, 0, nz], matrix));
        }
    } else {
        // Generic polygon: single "Side" using first edge's outward normal
        if (pts.length >= 2) {
            const a = pts[0], b = pts[1];
            const ex = b[0] - a[0], ez = b[2] - a[2];
            const len = Math.hypot(ex, ez) || 1;
            const nx = ez / len, nz = -ex / len;
            faces.push(makeFacePlane('Side', [(a[0] + b[0]) / 2, h / 2, (a[2] + b[2]) / 2], [nx, 0, nz], matrix));
        }
    }

    return faces;
}

/**
 * Map a box-face index to a human-readable label based on the approximate normal direction.
 */
function getFaceLabel(index, nx, nz) {
    if (Math.abs(nx) > Math.abs(nz)) {
        return nx > 0 ? 'Right' : 'Left';
    } else {
        return nz > 0 ? 'Front' : 'Back';
    }
}

/**
 * Given a Three.js mesh hit (with local normal and world hit point),
 * determine the exact face descriptor on that solid.
 */
export function getFaceFromHit(obj, localNormal, worldHitPoint) {
    const faces = enumerateFaces(obj);
    if (!faces || faces.length === 0) return null;

    // Check vertical caps first
    if (localNormal.y > 0.5) {
        return faces.find(f => f.label === 'Top') || faces[0];
    }
    if (localNormal.y < -0.5) {
        return faces.find(f => f.label === 'Bottom') || faces[0];
    }

    // Cylinder curved side: compute tangent plane at the clicked spot
    if (obj.type === 'CIRCLE') {
        const sideFace = faces.find(f => f.label === 'Side');
        if (worldHitPoint) {
            const matrix = getObjectMatrix(obj);
            const invMatrix = new THREE.Matrix4().copy(matrix).invert();
            const localHit = worldHitPoint.clone().applyMatrix4(invMatrix);
            const pts = obj.points || [];
            let cx = 0, cz = 0;
            for (const p of pts) { cx += p[0]; cz += p[2]; }
            if (pts.length > 0) { cx /= pts.length; cz /= pts.length; }

            const rx = localHit.x - cx;
            const rz = localHit.z - cz;
            const rLen = Math.hypot(rx, rz) || 1;
            const nx = rx / rLen;
            const nz = rz / rLen;

            const h = obj.extrudeHeight || 1;
            const clickedPos = [cx + rx, Math.max(0, Math.min(h, localHit.y)), cz + rz];
            return makeFacePlane('Side', clickedPos, [nx, 0, nz], matrix);
        }
        return sideFace || faces[0];
    }

    // Box side faces (Front, Back, Left, Right)
    if (obj.type === 'RECTANGLE') {
        let bestLabel = 'Front';
        if (Math.abs(localNormal.x) > Math.abs(localNormal.z)) {
            bestLabel = localNormal.x > 0 ? 'Right' : 'Left';
        } else {
            bestLabel = localNormal.z > 0 ? 'Front' : 'Back';
        }
        return faces.find(f => f.label === bestLabel) || faces[0];
    }

    return faces.find(f => f.label === 'Side') || faces[0];
}

/**
 * Given a THREE.Raycaster, find which face's plane was hit closest to the ray.
 */
export function raycastFace(raycaster, faces) {
    let bestFace = null;
    let bestDot  = -Infinity;

    for (const face of faces) {
        const n = new THREE.Vector3(...face.normal);
        const p = new THREE.Vector3(...face.position);

        const denom = raycaster.ray.direction.dot(n);
        if (Math.abs(denom) < 1e-6) continue;

        const t = p.clone().sub(raycaster.ray.origin).dot(n) / denom;
        if (t < 0) continue;

        const score = -denom;
        if (score > bestDot) {
            bestDot  = score;
            bestFace = face;
        }
    }

    return bestFace;
}
