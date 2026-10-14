/**
 * transformUtils.js - Deliberate Rotation Pivot and Rigid CAD Object Transformations
 *
 * Implements mathematically stable model rotations around a deliberate pivot
 * (default: object's 3D bounding box center) ensuring:
 * 1. Zero orbital movement or drifting.
 * 2. 100% preservation of geometric dimensions, angles, vertices, and watertightness.
 * 3. Strict separation between Camera Orbit, Work-Plane Rotation, and Model Rotation.
 */

import * as THREE from 'three';
import { getObjectMatrix } from '../cad/geometry/FaceEnumerator.js';

/**
 * Compute the 3D centroid / center of an object in world space.
 * Used as the deliberate rotation pivot for model rotation.
 *
 * @param {Object} obj - CAD object
 * @returns {THREE.Vector3} World-space center point
 */
export function getObjectWorldCenter(obj) {
    if (!obj) return new THREE.Vector3(0, 0, 0);

    const pts = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
    const h = obj.extrudeHeight || 0;
    const matrix = getObjectMatrix(obj);

    if (pts.length === 0) {
        return new THREE.Vector3().applyMatrix4(matrix);
    }

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const p of pts) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[2]);
        maxZ = Math.max(maxZ, p[2]);
    }

    const localCenter = new THREE.Vector3(
        (minX + maxX) / 2,
        h / 2,
        (minZ + maxZ) / 2
    );

    return localCenter.applyMatrix4(matrix);
}

/**
 * Rotate a CAD object around a deliberate pivot point by an incremental quaternion.
 *
 * Mathematical Invariant:
 * The pivot point P in world space remains completely stationary throughout rotation:
 *   Pivot_world(after) = Pivot_world(before)
 *
 * Derivation:
 * 1. Pivot in current local space:
 *      localPivot = curQuat^(-1) * (Pivot - curPos)
 * 2. New orientation:
 *      newQuat = deltaQuat * curQuat
 * 3. New planePosition:
 *      newPos = Pivot - newQuat * localPivot
 *
 * Under this formulation, the object spins cleanly in place around its pivot.
 *
 * @param {Object} obj - Existing CAD object
 * @param {THREE.Quaternion|THREE.Euler|Array<number>} deltaRotation - Incremental rotation
 * @param {THREE.Vector3|Array<number>} [customPivot=null] - Optional pivot; defaults to object center
 * @returns {{ planePosition: number[], planeRotation: number[] } | null}
 */
export function computeRotatedObjectTransform(obj, deltaRotation, customPivot = null) {
    if (!obj) return null;

    // 1. Deliberate pivot point in world space
    const pivot = customPivot
        ? (customPivot instanceof THREE.Vector3 ? customPivot : new THREE.Vector3(...customPivot))
        : getObjectWorldCenter(obj);

    // 2. Current orientation quaternion
    const curRot = obj.planeRotation || [Math.PI / 2, 0, 0];
    const curEuler = new THREE.Euler(curRot[0], curRot[1], curRot[2], 'XYZ');
    const curQuat = new THREE.Quaternion().setFromEuler(curEuler);

    // 3. Resolve incremental delta quaternion
    let deltaQuat;
    if (deltaRotation instanceof THREE.Quaternion) {
        deltaQuat = deltaRotation;
    } else if (deltaRotation instanceof THREE.Euler) {
        deltaQuat = new THREE.Quaternion().setFromEuler(deltaRotation);
    } else if (Array.isArray(deltaRotation)) {
        deltaQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(deltaRotation[0], deltaRotation[1], deltaRotation[2], 'XYZ')
        );
    } else {
        return null;
    }

    // 4. New orientation quaternion
    const newQuat = deltaQuat.clone().multiply(curQuat);
    const newEuler = new THREE.Euler().setFromQuaternion(newQuat, 'XYZ');

    // 5. Compute stable position adjustment preserving the pivot in world space
    const curPos = new THREE.Vector3(...(obj.planePosition || [0, 0, 0]));
    const pivotOffset = pivot.clone().sub(curPos);
    const localPivot = pivotOffset.applyQuaternion(curQuat.clone().invert());

    const newPivotOffset = localPivot.applyQuaternion(newQuat);
    const newPos = pivot.clone().sub(newPivotOffset);

    return {
        planePosition: [newPos.x, newPos.y, newPos.z],
        planeRotation: [newEuler.x, newEuler.y, newEuler.z]
    };
}
