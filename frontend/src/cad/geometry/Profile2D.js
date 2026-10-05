/**
 * Profile2D.js - Category 1: 2D Geometry & Planar Sketch Profiles
 * 
 * Formal representation of 2D planar sketches:
 * - Normal axis dimension = 0
 * - True 3D volume = 0
 * - Closed loop detection & polygon orientation (CW vs CCW)
 * - Shoelace planar area calculation
 * - Bounding box in local sketch coordinates
 */

import { GEOMETRY_KIND } from './GeometryTypes.js';

export class Profile2D {
    /**
     * @param {Object} options
     * @param {Array<Array<number>>} options.points - List of [x, 0, z] coordinates in local plane space
     * @param {string} options.type - 'RECTANGLE' | 'FREEHAND' | 'LINE'
     * @param {boolean} [options.isClosed] - Whether profile forms a closed boundary loop
     */
    constructor({ points = [], type = 'FREEHAND', isClosed = false } = {}) {
        this.kind = GEOMETRY_KIND.SKETCH_2D;
        this.type = type;
        this.points = points.map((p) => [p[0], p[1] || 0, p[2]]);
        this.isClosed = isClosed || this.detectClosedLoop();

        this.boundingBox = null;
        this.planarArea = 0;
        this.perimeter = 0;

        this.recompute();
    }

    detectClosedLoop() {
        if ((this.type === 'RECTANGLE' || this.type === 'CIRCLE') && this.points.length >= 3) return true;
        if (this.points.length < 3) return false;

        const first = this.points[0];
        const last = this.points[this.points.length - 1];
        const dist = Math.hypot(first[0] - last[0], first[2] - last[2]);
        return dist < 0.25;
    }

    recompute() {
        if (this.points.length === 0) {
            this.boundingBox = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, width: 0, depth: 0 };
            this.planarArea = 0;
            this.perimeter = 0;
            return;
        }

        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        let perim = 0;

        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[2] < minZ) minZ = p[2];
            if (p[2] > maxZ) maxZ = p[2];

            if (i > 0) {
                const prev = this.points[i - 1];
                perim += Math.hypot(p[0] - prev[0], p[2] - prev[2]);
            }
        }

        if (this.isClosed && this.points.length >= 3) {
            const first = this.points[0];
            const last = this.points[this.points.length - 1];
            perim += Math.hypot(first[0] - last[0], first[2] - last[2]);
        }

        this.boundingBox = {
            minX, maxX, minZ, maxZ,
            width: Math.max(0, maxX - minX),
            depth: Math.max(0, maxZ - minZ),
            centerX: (minX + maxX) / 2,
            centerZ: (minZ + maxZ) / 2
        };

        // Shoelace formula in local X-Z plane (Y = 0)
        let area = 0;
        const n = this.points.length;
        if (this.isClosed && n >= 3) {
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                area += this.points[i][0] * this.points[j][2];
                area -= this.points[j][0] * this.points[i][2];
            }
            area = Math.abs(area) * 0.5;
        }

        this.planarArea = area;
        this.perimeter = perim;
    }

    /**
     * Return 2D vertices in counter-clockwise winding order
     */
    getCcwPolygonPoints() {
        if (!this.isClosed || this.points.length < 3) {
            return this.points;
        }

        // Determine signed area to check orientation
        let signedArea = 0;
        const n = this.points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            signedArea += (this.points[j][0] - this.points[i][0]) * (this.points[j][2] + this.points[i][2]);
        }

        // In X-Z plane where +X is right and +Z is down/forward:
        const pts = [...this.points];
        if (signedArea > 0) {
            pts.reverse();
        }
        return pts;
    }
}
