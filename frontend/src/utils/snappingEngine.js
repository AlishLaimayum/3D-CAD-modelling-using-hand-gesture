/**
 * snappingEngine.js - High-Performance CAD Snapping Engine
 * 
 * Provides:
 * 1. Magnetic Vertex & Endpoint Snapping with Hysteresis (Zero allocation in hot loop).
 * 2. Midpoint Snapping for segment centers.
 * 3. Grid Snapping on the working plane.
 * 4. Angle / Orthogonal Snapping (0°, 45°, 90°, 135°, 180°) during drawing.
 */

export class SnappingEngine {
    constructor(options = {}) {
        this.snapDistance = options.snapDistance || 0.25;
        this.hysteresisFactor = options.hysteresisFactor || 1.4; // 40% release hysteresis
        this.gridSize = options.gridSize || 0.5;

        // Snapping mode toggles
        this.magneticEnabled = true;
        this.gridEnabled = false;
        this.angleSnapEnabled = false;
        this.midpointSnapEnabled = true;

        // Hysteresis lock state
        this.lockedVertex = null; // [x, y, z]
        this.snapType = null; // 'VERTEX' | 'MIDPOINT' | 'GRID' | 'ANGLE'
    }

    setSnapDistance(dist) {
        this.snapDistance = dist;
    }

    setGridSize(size) {
        this.gridSize = size;
    }

    setToggles({ magnetic, grid, angle, midpoint }) {
        if (magnetic !== undefined) this.magneticEnabled = magnetic;
        if (grid !== undefined) this.gridEnabled = grid;
        if (angle !== undefined) this.angleSnapEnabled = angle;
        if (midpoint !== undefined) this.midpointSnapEnabled = midpoint;
    }

    reset() {
        this.lockedVertex = null;
        this.snapType = null;
    }

    /**
     * Compute squared 3D distance between two coordinate triplets.
     */
    static distSq3D(p1, p2) {
        const dx = p1[0] - p2[0];
        const dy = p1[1] - p2[1];
        const dz = p1[2] - p2[2];
        return dx * dx + dy * dy + dz * dz;
    }

    /**
     * Perform full snapping calculation.
     * @param {Array<number>} worldPos - [x, y, z]
     * @param {Array<Object>} cadObjects - List of CAD objects (or lines)
     * @param {Array<number>|null} [drawStartPos=null] - [x, y, z] if actively drawing a segment
     * @param {Object|null} [planeManager=null] - For grid/angle projections
     * @returns {{ snappedPos: Array<number>, isSnapped: boolean, snapType: string|null, snappedTarget: Array<number>|null }}
     */
    snap(worldPos, cadObjects = [], drawStartPos = null, _planeManager = null) {
        if (!worldPos) {
            this.lockedVertex = null;
            this.snapType = null;
            return { snappedPos: worldPos, isSnapped: false, snapType: null, snappedTarget: null };
        }

        const enterThreshold = this.snapDistance;
        const enterThresholdSq = enterThreshold * enterThreshold;
        const releaseThreshold = enterThreshold * this.hysteresisFactor;
        const releaseThresholdSq = releaseThreshold * releaseThreshold;

        // ----------------------------------------------------
        // 1. HYSTERESIS CHECK ON EXISTING LOCKED VERTEX
        // ----------------------------------------------------
        if (this.lockedVertex && this.magneticEnabled) {
            const currentDistSq = SnappingEngine.distSq3D(worldPos, this.lockedVertex);
            if (currentDistSq <= releaseThresholdSq) {
                // Hand is still within the release boundary -> stay locked to this vertex
                return {
                    snappedPos: [...this.lockedVertex],
                    isSnapped: true,
                    snapType: this.snapType || 'VERTEX',
                    snappedTarget: [...this.lockedVertex]
                };
            }
            // Hand passed the release threshold -> release lock
            this.lockedVertex = null;
            this.snapType = null;
        }

        // ----------------------------------------------------
        // 2. MAGNETIC VERTEX & ENDPOINT SNAPPING (ZERO ALLOCATION)
        // ----------------------------------------------------
        if (this.magneticEnabled && cadObjects && cadObjects.length > 0) {
            let closestVertex = null;
            let closestDistSq = enterThresholdSq;
            let isMidpoint = false;

            for (let i = 0; i < cadObjects.length; i++) {
                const obj = cadObjects[i];
                if (!obj) continue;

                // Support both new CAD object format (points array) and legacy format (start & end)
                if (obj.points && obj.points.length > 0) {
                    const pts = obj.points;
                    const len = pts.length;
                    for (let j = 0; j < len; j++) {
                        const pt = pts[j];
                        const dx = worldPos[0] - pt[0];
                        const dy = worldPos[1] - pt[1];
                        const dz = worldPos[2] - pt[2];
                        const dSq = dx * dx + dy * dy + dz * dz;

                        if (dSq < closestDistSq) {
                            closestDistSq = dSq;
                            closestVertex = pt;
                            isMidpoint = false;
                        }

                        // Midpoint check between consecutive vertices
                        if (this.midpointSnapEnabled && j < len - 1) {
                            const nextPt = pts[j + 1];
                            const midX = (pt[0] + nextPt[0]) * 0.5;
                            const midY = (pt[1] + nextPt[1]) * 0.5;
                            const midZ = (pt[2] + nextPt[2]) * 0.5;
                            const mdx = worldPos[0] - midX;
                            const mdy = worldPos[1] - midY;
                            const mdz = worldPos[2] - midZ;
                            const midDistSq = mdx * mdx + mdy * mdy + mdz * mdz;

                            if (midDistSq < closestDistSq) {
                                closestDistSq = midDistSq;
                                closestVertex = [midX, midY, midZ];
                                isMidpoint = true;
                            }
                        }
                    }
                } else if (obj.start && obj.end) {
                    // Legacy line format
                    const sx = obj.start[0], sy = obj.start[1], sz = obj.start[2];
                    const ex = obj.end[0], ey = obj.end[1], ez = obj.end[2];

                    // Check start
                    let dx = worldPos[0] - sx;
                    let dy = worldPos[1] - sy;
                    let dz = worldPos[2] - sz;
                    let dSq = dx * dx + dy * dy + dz * dz;
                    if (dSq < closestDistSq) {
                        closestDistSq = dSq;
                        closestVertex = obj.start;
                        isMidpoint = false;
                    }

                    // Check end
                    dx = worldPos[0] - ex;
                    dy = worldPos[1] - ey;
                    dz = worldPos[2] - ez;
                    dSq = dx * dx + dy * dy + dz * dz;
                    if (dSq < closestDistSq) {
                        closestDistSq = dSq;
                        closestVertex = obj.end;
                        isMidpoint = false;
                    }

                    // Midpoint
                    if (this.midpointSnapEnabled) {
                        const midX = (sx + ex) * 0.5;
                        const midY = (sy + ey) * 0.5;
                        const midZ = (sz + ez) * 0.5;
                        dx = worldPos[0] - midX;
                        dy = worldPos[1] - midY;
                        dz = worldPos[2] - midZ;
                        dSq = dx * dx + dy * dy + dz * dz;
                        if (dSq < closestDistSq) {
                            closestDistSq = dSq;
                            closestVertex = [midX, midY, midZ];
                            isMidpoint = true;
                        }
                    }
                }
            }

            if (closestVertex) {
                this.lockedVertex = [closestVertex[0], closestVertex[1], closestVertex[2]];
                this.snapType = isMidpoint ? 'MIDPOINT' : 'VERTEX';
                return {
                    snappedPos: [...this.lockedVertex],
                    isSnapped: true,
                    snapType: this.snapType,
                    snappedTarget: [...this.lockedVertex]
                };
            }
        }

        // ----------------------------------------------------
        // 3. ANGLE / ORTHOGONAL SNAPPING (0°, 45°, 90°, 135°, 180°)
        // ----------------------------------------------------
        if (this.angleSnapEnabled && drawStartPos) {
            const ldx = worldPos[0] - drawStartPos[0];
            const ldz = worldPos[2] - drawStartPos[2]; // X-Z on working plane
            const dist = Math.hypot(ldx, ldz);

            if (dist > 0.15) {
                const angle = Math.atan2(ldz, ldx);
                const step = Math.PI / 4; // 45 degrees
                const snappedAngle = Math.round(angle / step) * step;
                const angleDiff = Math.abs(angle - snappedAngle);

                // Snap if within 10 degrees (~0.174 rad)
                if (angleDiff < 0.18) {
                    const snapX = drawStartPos[0] + Math.cos(snappedAngle) * dist;
                    const snapZ = drawStartPos[2] + Math.sin(snappedAngle) * dist;

                    return {
                        snappedPos: [snapX, worldPos[1], snapZ],
                        isSnapped: true,
                        snapType: 'ANGLE',
                        snappedTarget: [snapX, worldPos[1], snapZ]
                    };
                }
            }
        }

        // ----------------------------------------------------
        // 4. GRID SNAPPING (Directly aligned with visual working plane grid)
        // ----------------------------------------------------
        if (this.gridEnabled) {
            const gs = this.gridSize;
            const gx = Math.round(worldPos[0] / gs) * gs;
            const gy = 0;
            const gz = Math.round(worldPos[2] / gs) * gs;
            const gridDistSq = (worldPos[0] - gx) ** 2 + (worldPos[1] - gy) ** 2 + (worldPos[2] - gz) ** 2;

            if (gridDistSq < enterThresholdSq) {
                return {
                    snappedPos: [gx, gy, gz],
                    isSnapped: true,
                    snapType: 'GRID',
                    snappedTarget: [gx, gy, gz]
                };
            }
        }

        // No snap triggered
        this.lockedVertex = null;
        this.snapType = null;
        return {
            snappedPos: worldPos,
            isSnapped: false,
            snapType: null,
            snappedTarget: null
        };
    }
}
