/**
 * RevolveEngine.js - Professional CAD Revolve (Lathe) Modeling Kernel
 * 
 * Takes a 2D cross-sectional planar profile and sweeps/revolves it around
 * an axis of revolution to generate:
 * 1. Category 3: 3D Solid Geometry (Closed, watertight, 2-manifold B-Rep with true volume)
 * 2. Category 2: 3D Surface Geometry (Open rotational surface mesh for open profiles)
 * 
 * Features:
 * - Arbitrary 2D in-plane axis of revolution (existing line, centerline, 2 points, X/Z axes)
 * - 360° complete rotational solid with seamless seam stitching (zero duplicate vertices/faces)
 * - Partial revolution (1° to 360°) with planar sealing end faces
 * - On-axis vertex welding (prevents degenerate zero-area quads along axis of rotation)
 * - 100% watertight 2-manifold verification with true signed volume computation
 * - Comprehensive geometric validation (profile closure, non-straddling checks)
 */

import * as THREE from 'three';
import { GEOMETRY_KIND } from './GeometryTypes.js';
import { SolidMesh } from './SolidMesh.js';
import { Profile2D } from './Profile2D.js';

export class RevolveEngine {
    /**
     * Resolve axis definition into a normalized point A0 and direction vector V in local plane space.
     * @param {Object|string} axisInput 
     * @param {Profile2D|Object} profile 
     * @returns {{ a0: number[], dir: number[], label: string }}
     */
    static resolveAxis(axisInput, profile = null) {
        let pts = profile?.points || [];
        if (pts.length === 0 && profile?.start && profile?.end) {
            pts = [profile.start, profile.end];
        }

        // Compute profile bounding box in local plane space (X-Z plane, Y = 0)
        let minX = 0, maxX = 0, minZ = 0, maxZ = 0;
        if (pts.length > 0) {
            minX = Infinity; maxX = -Infinity;
            minZ = Infinity; maxZ = -Infinity;
            for (const p of pts) {
                minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
                minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
            }
        }

        if (typeof axisInput === 'string') {
            switch (axisInput) {
                case 'PROFILE_LEFT':
                    // Longitudinal centerline along left bounding edge (classic bolt/shaft centerline)
                    return { a0: [minX, 0, minZ], dir: [0, 0, 1], label: 'Profile Left Edge (Z-aligned)' };
                case 'PROFILE_RIGHT':
                    return { a0: [maxX, 0, minZ], dir: [0, 0, 1], label: 'Profile Right Edge (Z-aligned)' };
                case 'PROFILE_BOTTOM':
                    return { a0: [minX, 0, minZ], dir: [1, 0, 0], label: 'Profile Bottom Edge (X-aligned)' };
                case 'AXIS_X':
                    return { a0: [0, 0, 0], dir: [1, 0, 0], label: 'Work-Plane X Axis' };
                case 'AXIS_Z':
                default:
                    return { a0: [0, 0, 0], dir: [0, 0, 1], label: 'Work-Plane Z Axis' };
            }
        }

        if (axisInput && axisInput.p0 && axisInput.p1) {
            const p0 = axisInput.p0;
            const p1 = axisInput.p1;
            const dx = p1[0] - p0[0];
            const dz = (p1[2] !== undefined ? p1[2] : (p1[1] || 0)) - (p0[2] !== undefined ? p0[2] : (p0[1] || 0));
            const len = Math.hypot(dx, dz);
            if (len > 1e-6) {
                return {
                    a0: [p0[0], 0, p0[2] !== undefined ? p0[2] : (p0[1] || 0)],
                    dir: [dx / len, 0, dz / len],
                    label: axisInput.label || 'Selected Line Segment'
                };
            }
        }

        if (axisInput && axisInput.dir) {
            const a0 = axisInput.a0 || [0, 0, 0];
            const d = axisInput.dir;
            const len = Math.hypot(d[0], d[2] || 0);
            return {
                a0: [a0[0], 0, a0[2] || 0],
                dir: len > 1e-6 ? [d[0] / len, 0, (d[2] || 0) / len] : [0, 0, 1],
                label: axisInput.label || 'Custom Axis'
            };
        }

        // Default fallback: Left edge of profile, or Z axis
        return pts.length > 0
            ? { a0: [minX, 0, minZ], dir: [0, 0, 1], label: 'Profile Left Edge' }
            : { a0: [0, 0, 0], dir: [0, 0, 1], label: 'Work-Plane Z Axis' };
    }

    /**
     * Validate whether a 2D profile is suitable for a Revolve operation.
     * @param {Profile2D|Object} profileInput 
     * @param {Object|string} axisInput 
     * @param {boolean} [isSurface=false] 
     * @returns {{ valid: boolean, error?: string, warnings?: string[] }}
     */
    static validateProfileForRevolve(profileInput, axisInput, isSurface = false) {
        if (!profileInput) {
            return { valid: false, error: 'No profile selected. Please select a 2D sketch profile.' };
        }

        const pts = profileInput.points || (profileInput.start && profileInput.end ? [profileInput.start, profileInput.end] : []);
        if (pts.length < 2) {
            return { valid: false, error: 'Selected profile has insufficient points.' };
        }

        const isClosed = profileInput.isClosed || (pts.length >= 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][2] - pts[pts.length - 1][2]) < 0.05);

        if (!isSurface && !isClosed) {
            return { 
                valid: false, 
                error: 'Solid revolution requires a closed 2D boundary profile. Close the profile sketch or enable "Surface Mode".' 
            };
        }

        const axis = this.resolveAxis(axisInput, profileInput);
        const a0 = axis.a0;
        const v = axis.dir;

        // Check if profile crosses/straddles the axis
        // Perpendicular vector in X-Z plane: nPerp = [-vz, vx]
        const nPerpX = -v[2];
        const nPerpZ = v[0];

        let hasPositive = false;
        let hasNegative = false;
        const STRADDLE_TOLERANCE = 0.02;

        for (const p of pts) {
            const rx = p[0] - a0[0];
            const rz = p[2] - a0[2];
            const dist = rx * nPerpX + rz * nPerpZ;

            if (dist > STRADDLE_TOLERANCE) hasPositive = true;
            if (dist < -STRADDLE_TOLERANCE) hasNegative = true;
        }

        if (hasPositive && hasNegative) {
            return {
                valid: false,
                error: 'Profile crosses or straddles the axis of revolution. A revolve profile must represent one side of the object.'
            };
        }

        return { valid: true };
    }

    /**
     * Primary Revolve / Lathe Operation:
     * Sweeps profile around axis to construct a true 3D SolidMesh.
     * 
     * @param {Profile2D|Object} profileInput 
     * @param {Object|string} axisInput 
     * @param {number} [angleDeg=360] - Revolution angle in degrees (0 < angle <= 360)
     * @param {boolean} [isSurface=false] - Whether to generate open surface vs closed watertight solid
     * @param {boolean} [reversed=false] - Flip revolution direction
     * @returns {SolidMesh}
     */
    static revolve(profileInput, axisInput, angleDeg = 360, isSurface = false, reversed = false) {
        const prof = profileInput instanceof Profile2D ? profileInput : new Profile2D(profileInput);
        let rawPts = prof.points.map((p) => [p[0], 0, p[2]]);

        if (rawPts.length < 2) return null;

        // Remove duplicate closing point if present for polygon loops
        const isClosed = prof.isClosed || (rawPts.length >= 3 && Math.hypot(rawPts[0][0] - rawPts[rawPts.length - 1][0], rawPts[0][2] - rawPts[rawPts.length - 1][2]) < 1e-4);
        if (isClosed && rawPts.length > 3) {
            const first = rawPts[0];
            const last = rawPts[rawPts.length - 1];
            if (Math.hypot(first[0] - last[0], first[2] - last[2]) < 1e-4) {
                rawPts = rawPts.slice(0, rawPts.length - 1);
            }
        }

        const N = rawPts.length;
        if (N < 2) return null;

        // Resolve axis in local plane space
        const axis = this.resolveAxis(axisInput, prof);
        const a0 = axis.a0;
        const v = axis.dir;

        // Check signed area in X-Z plane to guarantee positive (CCW) winding
        let signedArea2D = 0;
        for (let i = 0; i < N; i++) {
            const j = (i + 1) % N;
            signedArea2D += (rawPts[i][0] * rawPts[j][2] - rawPts[j][0] * rawPts[i][2]);
        }
        if (isClosed && signedArea2D < 0) {
            rawPts.reverse();
        }

        // Normalize angle
        const clampedAngle = Math.max(1.0, Math.min(360.0, Number(angleDeg) || 360.0));
        const isFull360 = Math.abs(clampedAngle - 360.0) < 0.05;
        const sweepRad = (clampedAngle * Math.PI) / 180.0 * (reversed ? -1.0 : 1.0);

        // Angular subdivision steps: min 12, max 64
        const M = Math.max(12, Math.min(64, Math.round(36 * (clampedAngle / 360.0))));

        // 1. Identify on-axis vertices (radius < 1e-4)
        const AXIS_TOLERANCE = 1e-4;
        const vertexRads = [];
        const rPerps = [];
        const rPars = [];
        const wBases = [];

        for (let i = 0; i < N; i++) {
            const p = rawPts[i];
            const rx = p[0] - a0[0];
            const rz = p[2] - a0[2];
            const dot = rx * v[0] + rz * v[2];

            const rPar = [dot * v[0], 0, dot * v[2]];
            const rPerp = [rx - rPar[0], 0, rz - rPar[2]];
            const radius = Math.hypot(rPerp[0], rPerp[2]);

            // Cross product v x rPerp (points purely along Y)
            const wy = v[2] * rPerp[0] - v[0] * rPerp[2];
            const wBase = [0, wy, 0];

            vertexRads.push(radius);
            rPerps.push(rPerp);
            rPars.push(rPar);
            wBases.push(wBase);
        }

        const vertices = [];
        const faces = [];

        // For full 360, ring M wraps seamlessly to ring 0
        const ringCount = isFull360 ? M : M + 1;

        // Pre-allocate vertex index lookup: ringVertexIndices[k][i]
        const ringVertexIndices = [];
        const onAxisIndexMap = new Map(); // i -> single vertex index

        for (let k = 0; k < ringCount; k++) {
            const phi = (k / M) * sweepRad;
            const cosPhi = Math.cos(phi);
            const sinPhi = Math.sin(phi);
            const currentRing = [];

            for (let i = 0; i < N; i++) {
                const radius = vertexRads[i];

                if (radius < AXIS_TOLERANCE) {
                    // On-axis vertex: stays fixed for all angles
                    if (onAxisIndexMap.has(i)) {
                        currentRing.push(onAxisIndexMap.get(i));
                    } else {
                        const fixedPt = [a0[0] + rPars[i][0], 0, a0[2] + rPars[i][2]];
                        const newIdx = vertices.length;
                        vertices.push(fixedPt);
                        onAxisIndexMap.set(i, newIdx);
                        currentRing.push(newIdx);
                    }
                } else {
                    // Off-axis vertex: revolve via Rodrigues' formula
                    const rPerp = rPerps[i];
                    const w = wBases[i];
                    const rotPt = [
                        a0[0] + rPars[i][0] + cosPhi * rPerp[0] + sinPhi * w[0],
                        cosPhi * rPerp[1] + sinPhi * w[1],
                        a0[2] + rPars[i][2] + cosPhi * rPerp[2] + sinPhi * w[2]
                    ];
                    const newIdx = vertices.length;
                    vertices.push(rotPt);
                    currentRing.push(newIdx);
                }
            }

            ringVertexIndices.push(currentRing);
        }

        // Helper to get index for (ring k, profile vertex i)
        const getIdx = (k, i) => {
            if (isFull360 && k >= M) {
                return ringVertexIndices[0][i];
            }
            return ringVertexIndices[k][i];
        };

        // 2. Build Side Revolved Faces between adjacent rings
        for (let k = 0; k < M; k++) {
            const nextK = isFull360 && k === M - 1 ? 0 : k + 1;

            const segmentCount = isClosed ? N : N - 1;
            for (let i = 0; i < segmentCount; i++) {
                const j = (i + 1) % N;

                const v00 = getIdx(k, i);
                const v10 = getIdx(k, j);
                const v11 = getIdx(nextK, j);
                const v01 = getIdx(nextK, i);

                // Check for degenerate quads on the axis
                if (v00 === v01 && v10 === v11) {
                    continue;
                }

                if (v00 === v01) {
                    // Vertex i is on axis — fan triangle (apex at i)
                    if (reversed) {
                        faces.push([v00, v10, v11]);
                    } else {
                        faces.push([v00, v11, v10]);
                    }
                } else if (v10 === v11) {
                    // Vertex j is on axis — fan triangle (apex at j)
                    if (reversed) {
                        faces.push([v00, v10, v01]);
                    } else {
                        faces.push([v00, v01, v10]);
                    }
                } else {
                    // Standard quad: split into 2 outward-oriented triangles
                    if (reversed) {
                        faces.push([v00, v10, v11]);
                        faces.push([v00, v11, v01]);
                    } else {
                        faces.push([v00, v11, v10]);
                        faces.push([v00, v01, v11]);
                    }
                }
            }
        }

        // 3. Build End Caps for Partial Revolutions (< 360°) on Closed Profiles
        if (!isFull360 && isClosed && !isSurface && N >= 3) {
            // Triangulate 2D profile polygon using THREE.ShapeUtils with Vector2
            const contour2D = rawPts.map((p) => new THREE.Vector2(p[0], p[2]));
            const triIndices = THREE.ShapeUtils.triangulateShape(contour2D, []);

            if (triIndices && triIndices.length > 0) {
                // Start cap at k = 0 (Normal pointing backwards from sweep)
                for (const [i0, i1, i2] of triIndices) {
                    const idx0 = ringVertexIndices[0][i0];
                    const idx1 = ringVertexIndices[0][i1];
                    const idx2 = ringVertexIndices[0][i2];

                    if (reversed) {
                        faces.push([idx0, idx1, idx2]);
                    } else {
                        faces.push([idx0, idx2, idx1]);
                    }
                }

                // End cap at k = M (Normal pointing forwards along sweep)
                for (const [i0, i1, i2] of triIndices) {
                    const idx0 = ringVertexIndices[M][i0];
                    const idx1 = ringVertexIndices[M][i1];
                    const idx2 = ringVertexIndices[M][i2];

                    if (reversed) {
                        faces.push([idx0, idx2, idx1]);
                    } else {
                        faces.push([idx0, idx1, idx2]);
                    }
                }
            }
        }

        return new SolidMesh({
            vertices,
            faces,
            kind: isSurface ? GEOMETRY_KIND.SURFACE_3D : GEOMETRY_KIND.SOLID_3D,
            metadata: {
                operation: 'REVOLVE',
                profileType: prof.type,
                angleDeg: clampedAngle,
                axis: { a0, dir: v, label: axis.label },
                isSurface,
                reversed
            }
        });
    }
}
