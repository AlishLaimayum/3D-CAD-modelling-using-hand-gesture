/**
 * ExtrusionEngine.js - Primary CAD Modeling Operation: Sketch -> Profile -> Extrude -> Solid
 * 
 * Takes a 2D planar profile and sweeps/extrudes it along the working plane normal
 * to produce:
 * 1. Category 3: 3D Solid Geometry (Closed, watertight, 2-manifold B-Rep) if profile is closed
 * 2. Category 2: 3D Surface Geometry (Open manifold surface mesh) if profile is open
 */

import { GEOMETRY_KIND } from './GeometryTypes.js';
import { SolidMesh } from './SolidMesh.js';
import { Profile2D } from './Profile2D.js';

export class ExtrusionEngine {
    /**
     * Extrude a 2D profile along the local normal axis (Y in local plane space)
     * @param {Profile2D|Object} profile - Profile2D or object with { points, type, isClosed }
     * @param {number} height - Extrusion distance (> 0)
     * @returns {SolidMesh}
     */
    static extrude(profile, height = 1.0) {
        const h = Math.max(0.001, height);
        const prof = profile instanceof Profile2D ? profile : new Profile2D(profile);

        if (prof.isClosed && prof.points.length >= 3) {
            return this.extrudeClosedPolygon(prof, h);
        } else {
            return this.extrudeOpenCurve(prof, h);
        }
    }

    /**
     * Extrude a closed 2D polygon into a watertight 3D solid B-Rep
     * @private
     */
    static extrudeClosedPolygon(profile, height) {
        let pts = profile.points.map((p) => [p[0], 0, p[2]]);
        
        // Remove duplicate closing point if present
        if (pts.length > 3) {
            const first = pts[0];
            const last = pts[pts.length - 1];
            if (Math.hypot(first[0] - last[0], first[2] - last[2]) < 1e-5) {
                pts = pts.slice(0, pts.length - 1);
            }
        }

        const N = pts.length;
        if (N < 3) return null;

        // Compute 2D signed area in X-Z plane to guarantee positive winding
        let signedArea2D = 0;
        for (let i = 0; i < N; i++) {
            const j = (i + 1) % N;
            signedArea2D += (pts[i][0] * pts[j][2] - pts[j][0] * pts[i][2]);
        }
        if (signedArea2D < 0) {
            pts.reverse();
        }

        const vertices = [];
        const faces = [];

        // 1. Bottom ring vertices (Y = 0)
        for (let i = 0; i < N; i++) {
            vertices.push([pts[i][0], 0, pts[i][2]]);
        }

        // 2. Top ring vertices (Y = height)
        for (let i = 0; i < N; i++) {
            vertices.push([pts[i][0], height, pts[i][2]]);
        }

        // 3. Bottom Cap Face(s) (Normal points DOWN: [0, -1, 0])
        for (let i = 1; i < N - 1; i++) {
            faces.push([0, i, i + 1]);
        }

        // 4. Top Cap Face(s) (Normal points UP: [0, 1, 0])
        for (let i = 1; i < N - 1; i++) {
            faces.push([N, N + i + 1, N + i]);
        }

        // 5. Side Wall Faces (Normals point OUTWARD)
        for (let i = 0; i < N; i++) {
            const j = (i + 1) % N;
            const b0 = i;
            const b1 = j;
            const t0 = i + N;
            const t1 = j + N;

            // Two CCW triangles per quad wall facing outward:
            faces.push([b0, t0, t1]);
            faces.push([b0, t1, b1]);
        }

        return new SolidMesh({
            vertices,
            faces,
            kind: GEOMETRY_KIND.SOLID_3D,
            metadata: {
                operation: 'EXTRUDE',
                profileType: profile.type,
                extrudeHeight: height,
                sourcePoints: pts
            }
        });
    }

    /**
     * Extrude an open 2D curve into an open 3D surface mesh (Category 2: Surface)
     * @private
     */
    static extrudeOpenCurve(profile, height) {
        const pts = profile.points;
        const N = pts.length;
        const vertices = [];
        const faces = [];

        // Bottom vertices
        for (let i = 0; i < N; i++) {
            vertices.push([pts[i][0], 0, pts[i][2]]);
        }
        // Top vertices
        for (let i = 0; i < N; i++) {
            vertices.push([pts[i][0], height, pts[i][2]]);
        }

        // Side ribbon faces
        for (let i = 0; i < N - 1; i++) {
            const b0 = i;
            const b1 = i + 1;
            const t0 = i + N;
            const t1 = i + 1 + N;

            faces.push([b0, b1, t1]);
            faces.push([b0, t1, t0]);
        }

        return new SolidMesh({
            vertices,
            faces,
            kind: GEOMETRY_KIND.SURFACE_3D,
            metadata: {
                operation: 'EXTRUDE_SURFACE',
                profileType: profile.type,
                extrudeHeight: height
            }
        });
    }

    /**
     * Create an exact CAD box solid from rectangle corners and height
     * Guarantees 8 vertices, 12 triangulated faces (6 rectangular sides),
     * volume = width * depth * height, and Euler characteristic = 2.
     * @param {Array<Array<number>>} corners - 4 corner vertices [x, 0, z]
     * @param {number} height - Extrusion height along normal
     */
    static createBoxSolid(corners, height = 1.0) {
        const h = Math.max(0.001, height);
        const prof = new Profile2D({
            points: corners,
            type: 'RECTANGLE',
            isClosed: true
        });
        return this.extrudeClosedPolygon(prof, h);
    }
}
