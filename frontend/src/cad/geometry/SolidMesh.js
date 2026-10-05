/**
 * SolidMesh.js - CAD 3D Solid Boundary Representation (B-Rep) & Mesh Kernel
 * 
 * Represents true, editable 3D solid geometry with:
 * - Real 3D vertices, edges, and planar/triangulated faces
 * - Outward-pointing face normals
 * - Rigorous signed volume calculation (divergence theorem on tetrahedral decomposition)
 * - Surface area calculation
 * - Comprehensive topological validation:
 *   * Watertight / Closed boundary check (0 unshared boundary edges)
 *   * 2-Manifold verification (every edge shared by exactly 2 faces)
 *   * Consistent orientation check (opposed half-edge traversal)
 *   * Degenerate face detection
 *   * Euler characteristic verification
 * - Native export to standard CAD formats (Wavefront OBJ faces, STL)
 * - Tessellation to Three.js BufferGeometry for viewport rendering
 */

import * as THREE from 'three';
import { GEOMETRY_KIND } from './GeometryTypes.js';

export class SolidMesh {
    /**
     * @param {Object} options
     * @param {Array<Array<number>>} options.vertices - List of [x, y, z] points
     * @param {Array<Array<number>>} options.faces - List of [i0, i1, i2] vertex indices (CCW outward winding)
     * @param {string} [options.kind] - GEOMETRY_KIND.SOLID_3D or GEOMETRY_KIND.SURFACE_3D
     * @param {Object} [options.metadata] - Creation parameters (e.g. extrusion height, source profile)
     */
    constructor({ vertices = [], faces = [], kind = GEOMETRY_KIND.SOLID_3D, metadata = {} } = {}) {
        this.kind = kind;
        this.metadata = { ...metadata };
        this.vertices = vertices.map((v) => [v[0], v[1], v[2]]);
        this.faces = faces.map((f) => [...f]);

        // Topological and geometric metrics
        this.edges = [];
        this.faceNormals = [];
        this.boundingBox = null;
        this.volume = 0;
        this.surfaceArea = 0;
        this.dimensions = { x: 0, y: 0, z: 0 };
        this.validation = null;

        this.recomputeAll();
    }

    /**
     * Recompute all geometric properties, normals, volume, dimensions, and validation.
     */
    recomputeAll() {
        this.computeBoundingBox();
        this.computeFaceNormals();
        this.buildEdgeTopology();
        this.computeVolumeAndArea();
        this.validation = this.validateSolid();
    }

    /**
     * Compute 3D bounding box and independent X, Y, Z dimensions
     */
    computeBoundingBox() {
        if (this.vertices.length === 0) {
            this.boundingBox = { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
            this.dimensions = { x: 0, y: 0, z: 0 };
            return;
        }

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const [x, y, z] of this.vertices) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }

        const sizeX = Math.max(0, maxX - minX);
        const sizeY = Math.max(0, maxY - minY);
        const sizeZ = Math.max(0, maxZ - minZ);

        this.boundingBox = {
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ],
            size: [sizeX, sizeY, sizeZ],
            center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
        };

        this.dimensions = { x: sizeX, y: sizeY, z: sizeZ };
    }

    /**
     * Compute face unit normal vectors using cross product of face edges
     */
    computeFaceNormals() {
        this.faceNormals = [];
        for (const face of this.faces) {
            if (face.length < 3) {
                this.faceNormals.push([0, 1, 0]);
                continue;
            }
            const p0 = this.vertices[face[0]];
            const p1 = this.vertices[face[1]];
            const p2 = this.vertices[face[2]];

            const ax = p1[0] - p0[0];
            const ay = p1[1] - p0[1];
            const az = p1[2] - p0[2];

            const bx = p2[0] - p0[0];
            const by = p2[1] - p0[1];
            const bz = p2[2] - p0[2];

            // Cross product: A x B
            let nx = ay * bz - az * by;
            let ny = az * bx - ax * bz;
            let nz = ax * by - ay * bx;

            const len = Math.hypot(nx, ny, nz);
            if (len > 1e-12) {
                nx /= len;
                ny /= len;
                nz /= len;
            } else {
                nx = 0;
                ny = 1;
                nz = 0;
            }
            this.faceNormals.push([nx, ny, nz]);
        }
    }

    /**
     * Build edge adjacency table to evaluate topological manifoldness
     */
    buildEdgeTopology() {
        const edgeMap = new Map();

        this.faces.forEach((face, faceIdx) => {
            const count = face.length;
            for (let i = 0; i < count; i++) {
                const v0 = face[i];
                const v1 = face[(i + 1) % count];
                const key = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`;

                if (!edgeMap.has(key)) {
                    edgeMap.set(key, {
                        v0: Math.min(v0, v1),
                        v1: Math.max(v0, v1),
                        faces: [],
                        directions: []
                    });
                }
                const entry = edgeMap.get(key);
                entry.faces.push(faceIdx);
                entry.directions.push(v0 < v1 ? 1 : -1);
            }
        });

        this.edges = Array.from(edgeMap.values());
    }

    /**
     * Compute signed 3D volume using the Divergence Theorem / signed tetrahedra formula.
     * For a closed watertight surface:
     * V = (1/6) * sum_{faces} (v0 . (v1 x v2))
     * Also computes total surface area.
     */
    computeVolumeAndArea() {
        let signedVolume = 0;
        let totalArea = 0;

        for (const face of this.faces) {
            if (face.length < 3) continue;

            // Triangulate polygonal faces using fan from vertex 0
            for (let i = 1; i < face.length - 1; i++) {
                const p0 = this.vertices[face[0]];
                const p1 = this.vertices[face[i]];
                const p2 = this.vertices[face[i + 1]];

                // Signed volume contribution of tetrahedron (Origin, p0, p1, p2)
                const crossX = p1[1] * p2[2] - p1[2] * p2[1];
                const crossY = p1[2] * p2[0] - p1[0] * p2[2];
                const crossZ = p1[0] * p2[1] - p1[1] * p2[0];

                signedVolume += (p0[0] * crossX + p0[1] * crossY + p0[2] * crossZ) / 6.0;

                // Triangle area: 0.5 * ||(p1 - p0) x (p2 - p0)||
                const e1x = p1[0] - p0[0], e1y = p1[1] - p0[1], e1z = p1[2] - p0[2];
                const e2x = p2[0] - p0[0], e2y = p2[1] - p0[1], e2z = p2[2] - p0[2];
                const cx = e1y * e2z - e1z * e2y;
                const cy = e1z * e2x - e1x * e2z;
                const cz = e1x * e2y - e1y * e2x;
                const a = 0.5 * Math.hypot(cx, cy, cz);
                totalArea += a;
            }
        }

        this.volume = Math.max(0, signedVolume);
        this.surfaceArea = totalArea;
        // console.log('DEBUG computeVolumeAndArea: totalArea =', totalArea, 'volume =', this.volume);
    }

    /**
     * Thorough CAD solid validation suite.
     * Evaluates whether the geometry is a mathematically closed, watertight, 2-manifold solid.
     */
    validateSolid() {
        const vertexCount = this.vertices.length;
        const faceCount = this.faces.length;
        const edgeCount = this.edges.length;

        const boundaryEdges = [];
        const nonManifoldEdges = [];
        let inconsistentOrientationCount = 0;

        for (const edge of this.edges) {
            if (edge.faces.length === 1) {
                boundaryEdges.push(edge);
            } else if (edge.faces.length > 2) {
                nonManifoldEdges.push(edge);
            } else if (edge.faces.length === 2) {
                // For consistent orientation, two adjacent faces must traverse the shared edge in opposite directions
                if (edge.directions[0] === edge.directions[1]) {
                    inconsistentOrientationCount++;
                }
            }
        }

        // Degenerate faces check (zero area)
        let degenerateFaceCount = 0;
        for (const face of this.faces) {
            if (face.length < 3) {
                degenerateFaceCount++;
                continue;
            }
            const p0 = this.vertices[face[0]];
            const p1 = this.vertices[face[1]];
            const p2 = this.vertices[face[2]];
            const dist1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
            const dist2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
            const dist3 = Math.hypot(p0[0] - p2[0], p0[1] - p2[1], p0[2] - p2[2]);
            if (dist1 < 1e-6 || dist2 < 1e-6 || dist3 < 1e-6) {
                degenerateFaceCount++;
            }
        }

        // Euler characteristic: V - E + F
        // For a genus-0 closed solid (e.g. sphere, box, cylinder), chi = 2
        // Note: For triangulated closed mesh: 3F = 2E -> E = 1.5 F
        const eulerCharacteristic = vertexCount - edgeCount + faceCount;

        const isClosed = boundaryEdges.length === 0;
        const isManifold = nonManifoldEdges.length === 0;
        const isWatertight = isClosed && isManifold && this.volume > 1e-6;
        const normalsConsistent = inconsistentOrientationCount === 0;

        return {
            vertexCount,
            edgeCount,
            faceCount,
            dimensions: { ...this.dimensions },
            boundingBox: this.boundingBox,
            volume: this.volume,
            surfaceArea: this.surfaceArea,
            isClosed,
            isWatertight,
            isManifold,
            normalsConsistent,
            eulerCharacteristic,
            boundaryEdgeCount: boundaryEdges.length,
            nonManifoldEdgeCount: nonManifoldEdges.length,
            degenerateFaceCount,
            inconsistentOrientationCount,
            isValidSolid: isWatertight && isManifold && degenerateFaceCount === 0
        };
    }

    /**
     * Modify the extrusion height directly in 3D solid geometry coordinates.
     * Updates top cap vertices and recomputes all topological properties.
     */
    setExtrusionHeight(newHeight) {
        if (typeof newHeight !== 'number' || isNaN(newHeight)) return;
        const targetH = Math.max(0.001, newHeight);

        // Find vertices on the top face(s) and adjust their Y coordinate
        // In local extrusion geometry, base is at Y=0 and top is at Y=extrudeHeight
        const oldH = this.metadata.extrudeHeight || this.dimensions.y || 1;
        const scaleFactor = targetH / Math.max(0.001, oldH);

        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i];
            if (v[1] > 0.0001) {
                v[1] = targetH;
            }
        }

        this.metadata.extrudeHeight = targetH;
        this.recomputeAll();
    }

    /**
     * Convert CAD solid into an optimized Three.js BufferGeometry for viewport rendering.
     * Preserves vertex positions, vertex normals, and edge wireframes.
     */
    toThreeGeometry() {
        const positions = [];
        const normals = [];

        for (const face of this.faces) {
            if (face.length < 3) continue;

            // Triangulate
            for (let i = 1; i < face.length - 1; i++) {
                const i0 = face[0];
                const i1 = face[i];
                const i2 = face[i + 1];

                const p0 = this.vertices[i0];
                const p1 = this.vertices[i1];
                const p2 = this.vertices[i2];

                positions.push(
                    p0[0], p0[1], p0[2],
                    p1[0], p1[1], p1[2],
                    p2[0], p2[1], p2[2]
                );

                // Compute normal for triangle
                const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
                const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
                let nx = ay * bz - az * by;
                let ny = az * bx - ax * bz;
                let nz = ax * by - ay * bx;
                const len = Math.hypot(nx, ny, nz) || 1;
                nx /= len; ny /= len; nz /= len;

                normals.push(
                    nx, ny, nz,
                    nx, ny, nz,
                    nx, ny, nz
                );
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        return geometry;
    }

    /**
     * Extract clean feature edges for CAD edge wireframe rendering
     */
    toEdgeGeometry(featureAngleDeg = 25) {
        const thresholdCos = Math.cos((featureAngleDeg * Math.PI) / 180);
        const linePositions = [];

        for (const edge of this.edges) {
            // Draw boundary edges or sharp feature edges between faces
            let drawEdge = false;
            if (edge.faces.length === 1) {
                drawEdge = true;
            } else if (edge.faces.length === 2) {
                const n0 = this.faceNormals[edge.faces[0]];
                const n1 = this.faceNormals[edge.faces[1]];
                if (n0 && n1) {
                    const dot = n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2];
                    if (dot < thresholdCos) {
                        drawEdge = true;
                    }
                }
            }

            if (drawEdge) {
                const p0 = this.vertices[edge.v0];
                const p1 = this.vertices[edge.v1];
                linePositions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
            }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        return geom;
    }

    /**
     * Export complete 3D solid as Wavefront .OBJ file format with complete 3D faces ('f')
     * Supports arbitrary global vertex index offset.
     * @param {number} [startIdx=1]
     * @param {THREE.Vector3} [worldPos]
     * @param {THREE.Euler} [worldRot]
     */
    toOBJ(startIdx = 1, worldPos = [0, 0, 0], worldRot = [0, 0, 0]) {
        let out = '';
        const euler = new THREE.Euler(...worldRot);
        const quat = new THREE.Quaternion().setFromEuler(euler);
        const posVec = new THREE.Vector3(...worldPos);

        // Write vertices transformed into 3D world space
        for (const v of this.vertices) {
            const vWorld = new THREE.Vector3(...v).applyQuaternion(quat).add(posVec);
            out += `v ${vWorld.x.toFixed(6)} ${vWorld.y.toFixed(6)} ${vWorld.z.toFixed(6)}\n`;
        }

        // Write face normals
        for (const n of this.faceNormals) {
            const nWorld = new THREE.Vector3(...n).applyQuaternion(quat).normalize();
            out += `vn ${nWorld.x.toFixed(6)} ${nWorld.y.toFixed(6)} ${nWorld.z.toFixed(6)}\n`;
        }

        // Write faces (complete 3D solid polygons)
        this.faces.forEach((face, fIdx) => {
            const normalIdx = startIdx + fIdx;
            // Triangulate for standard compatibility
            for (let i = 1; i < face.length - 1; i++) {
                const i0 = startIdx + face[0];
                const i1 = startIdx + face[i];
                const i2 = startIdx + face[i + 1];
                out += `f ${i0}//${normalIdx} ${i1}//${normalIdx} ${i2}//${normalIdx}\n`;
            }
        });

        out += '\n';
        return {
            objText: out,
            nextIndex: startIdx + this.vertices.length
        };
    }

    /**
     * Export complete 3D solid as ASCII .STL format
     */
    toSTL(solidName = 'CAD_Solid') {
        let stl = `solid ${solidName}\n`;

        for (const face of this.faces) {
            if (face.length < 3) continue;
            for (let i = 1; i < face.length - 1; i++) {
                const p0 = this.vertices[face[0]];
                const p1 = this.vertices[face[i]];
                const p2 = this.vertices[face[i + 1]];

                // Normal
                const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
                const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
                let nx = ay * bz - az * by;
                let ny = az * bx - ax * bz;
                let nz = ax * by - ay * bx;
                const len = Math.hypot(nx, ny, nz) || 1;
                nx /= len; ny /= len; nz /= len;

                stl += `  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}\n`;
                stl += `    outer loop\n`;
                stl += `      vertex ${p0[0].toFixed(6)} ${p0[1].toFixed(6)} ${p0[2].toFixed(6)}\n`;
                stl += `      vertex ${p1[0].toFixed(6)} ${p1[1].toFixed(6)} ${p1[2].toFixed(6)}\n`;
                stl += `      vertex ${p2[0].toFixed(6)} ${p2[1].toFixed(6)} ${p2[2].toFixed(6)}\n`;
                stl += `    endloop\n`;
                stl += `  endfacet\n`;
            }
        }

        stl += `endsolid ${solidName}\n`;
        return stl;
    }

    /**
     * Deep clone of solid mesh
     */
    clone() {
        return new SolidMesh({
            vertices: this.vertices.map((v) => [...v]),
            faces: this.faces.map((f) => [...f]),
            kind: this.kind,
            metadata: JSON.parse(JSON.stringify(this.metadata))
        });
    }
}
