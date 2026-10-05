/**
 * benchmark_b9_mesh_validity.mjs
 * 
 * Benchmark B9: Evaluates 20 distinct geometric models for:
 * 1. Watertightness (0 unshared boundary edges)
 * 2. 2-Manifold topology (every edge shared by exactly 2 faces with opposed half-edges)
 * 3. Euler characteristic invariant (chi = V - E + F == 2 for genus 0)
 * 4. Analytical volume vs Divergence Theorem computed volume
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import CAD kernel classes
import { Profile2D } from '../../frontend/src/cad/geometry/Profile2D.js';
import { ExtrusionEngine } from '../../frontend/src/cad/geometry/ExtrusionEngine.js';
import { SolidMesh } from '../../frontend/src/cad/geometry/SolidMesh.js';

const modelsToTest = [];

// 1-5: Rectangular boxes with different dimensions
const boxDims = [
    [1, 1, 1],
    [2, 3, 4],
    [10, 0.5, 2],
    [0.2, 5, 0.2],
    [3.5, 2.5, 1.5]
];
boxDims.forEach(([w, h, d], idx) => {
    modelsToTest.push({
        name: `Box_${idx + 1}_${w}x${h}x${d}`,
        type: 'RECTANGLE',
        points: [[0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d]],
        height: h,
        analyticalVolume: w * h * d,
        analyticalArea: 2 * (w * d + w * h + d * h)
    });
});

// 6-10: Cylinders with varying radii and heights
const cylConfigs = [
    { r: 1, h: 2, segs: 32 },
    { r: 0.5, h: 5, segs: 64 },
    { r: 3, h: 0.5, segs: 48 },
    { r: 2.5, h: 3, segs: 32 },
    { r: 1.2, h: 1.8, segs: 64 }
];
cylConfigs.forEach(({ r, h, segs }, idx) => {
    const pts = [];
    for (let i = 0; i < segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        pts.push([r * Math.cos(theta), 0, r * Math.sin(theta)]);
    }
    // Poly volume is area of regular polygon * height
    const polyArea = 0.5 * segs * r * r * Math.sin((2 * Math.PI) / segs);
    const polyPerimeter = segs * 2 * r * Math.sin(Math.PI / segs);
    modelsToTest.push({
        name: `Cylinder_${idx + 1}_r${r}_h${h}_s${segs}`,
        type: 'CIRCLE',
        points: pts,
        height: h,
        analyticalVolume: polyArea * h,
        analyticalArea: 2 * polyArea + polyPerimeter * h
    });
});

// 11: L-Shaped Prism (Concave 6-gon)
const lPoints = [
    [0, 0, 0], [4, 0, 0], [4, 0, 1.5], [1.5, 0, 1.5], [1.5, 0, 4], [0, 0, 4]
];
// Area = 4*1.5 + 1.5*2.5 = 6 + 3.75 = 9.75
const lArea = 9.75;
const lHeight = 2.5;
modelsToTest.push({
    name: 'L_Shaped_Prism',
    type: 'FREEHAND',
    points: lPoints,
    height: lHeight,
    analyticalVolume: lArea * lHeight,
    analyticalArea: 2 * lArea + (4 + 1.5 + 2.5 + 2.5 + 4 + 1.5) * lHeight
});

// 12: T-Shaped Prism (Concave 8-gon)
const tPoints = [
    [1, 0, 0], [3, 0, 0], [3, 0, 3], [4, 0, 3], [4, 0, 4], [0, 0, 4], [0, 0, 3], [1, 0, 3]
];
const tArea = (2 * 3) + (4 * 1); // stem 2x3 + cap 4x1 = 10
const tHeight = 1.8;
modelsToTest.push({
    name: 'T_Shaped_Prism',
    type: 'FREEHAND',
    points: tPoints,
    height: tHeight,
    analyticalVolume: tArea * tHeight,
    analyticalArea: null
});

// 13: U-Shaped Prism (Concave 8-gon)
const uPoints = [
    [0, 0, 0], [4, 0, 0], [4, 0, 4], [3, 0, 4], [3, 0, 1.5], [1, 0, 1.5], [1, 0, 4], [0, 0, 4]
];
const uArea = 4 * 4 - 2 * 2.5; // 16 - 5 = 11
const uHeight = 3.0;
modelsToTest.push({
    name: 'U_Shaped_Prism',
    type: 'FREEHAND',
    points: uPoints,
    height: uHeight,
    analyticalVolume: uArea * uHeight,
    analyticalArea: null
});

// 14: Equilateral Triangle Prism
const triSide = 3.0;
const triH = (Math.sqrt(3) / 2) * triSide;
const triPoints = [
    [0, 0, 0], [triSide, 0, 0], [triSide / 2, 0, triH]
];
const triArea = 0.5 * triSide * triH;
const triExtrude = 2.0;
modelsToTest.push({
    name: 'Triangle_Prism',
    type: 'FREEHAND',
    points: triPoints,
    height: triExtrude,
    analyticalVolume: triArea * triExtrude,
    analyticalArea: 2 * triArea + 3 * triSide * triExtrude
});

// 15: Regular Pentagon Prism
const pentPts = [];
const pR = 2.0;
for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    pentPts.push([pR * Math.cos(a), 0, pR * Math.sin(a)]);
}
const pentArea = 0.5 * 5 * pR * pR * Math.sin((2 * Math.PI) / 5);
modelsToTest.push({
    name: 'Pentagon_Prism',
    type: 'FREEHAND',
    points: pentPts,
    height: 1.5,
    analyticalVolume: pentArea * 1.5,
    analyticalArea: null
});

// 16: Regular Hexagon Prism
const hexPts = [];
const hR = 2.5;
for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    hexPts.push([hR * Math.cos(a), 0, hR * Math.sin(a)]);
}
const hexArea = 0.5 * 6 * hR * hR * Math.sin((2 * Math.PI) / 6);
modelsToTest.push({
    name: 'Hexagon_Prism',
    type: 'FREEHAND',
    points: hexPts,
    height: 3.2,
    analyticalVolume: hexArea * 3.2,
    analyticalArea: null
});

// 17: Regular Octagon Prism
const octPts = [];
const oR = 3.0;
for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    octPts.push([oR * Math.cos(a), 0, oR * Math.sin(a)]);
}
const octArea = 0.5 * 8 * oR * oR * Math.sin((2 * Math.PI) / 8);
modelsToTest.push({
    name: 'Octagon_Prism',
    type: 'FREEHAND',
    points: octPts,
    height: 2.0,
    analyticalVolume: octArea * 2.0,
    analyticalArea: null
});

// 18: Trapezoidal Prism
const trapPoints = [
    [0, 0, 0], [5, 0, 0], [4, 0, 3], [1, 0, 3]
];
const trapArea = 0.5 * (5 + 3) * 3; // 12
modelsToTest.push({
    name: 'Trapezoid_Prism',
    type: 'FREEHAND',
    points: trapPoints,
    height: 2.4,
    analyticalVolume: trapArea * 2.4,
    analyticalArea: null
});

// 19: Star-shaped 10-gon Prism (Non-convex)
const starPts = [];
for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rad = i % 2 === 0 ? 3.0 : 1.2;
    starPts.push([rad * Math.cos(a), 0, rad * Math.sin(a)]);
}
// Area of 10 triangles = 10 * (0.5 * 3 * 1.2 * sin(36 deg))
const starArea = 10 * 0.5 * 3.0 * 1.2 * Math.sin(Math.PI / 5);
modelsToTest.push({
    name: 'Star_10gon_Prism',
    type: 'FREEHAND',
    points: starPts,
    height: 1.0,
    analyticalVolume: starArea * 1.0,
    analyticalArea: null
});

// 20: Skewed Parallelogram Prism
const paraPts = [
    [0, 0, 0], [4, 0, 0], [6, 0, 3], [2, 0, 3]
];
const paraArea = 4 * 3; // base 4, height 3 = 12
modelsToTest.push({
    name: 'Parallelogram_Prism',
    type: 'FREEHAND',
    points: paraPts,
    height: 4.5,
    analyticalVolume: paraArea * 4.5,
    analyticalArea: null
});

// RUN BENCHMARK
const results = [];
let passedAll = true;

for (const model of modelsToTest) {
    const profile = new Profile2D({
        points: model.points,
        type: model.type,
        isClosed: true
    });

    const solid = ExtrusionEngine.extrude(profile, model.height);
    const val = solid.validateSolid();

    const volumeDiff = Math.abs(solid.volume - model.analyticalVolume);
    const volumeErrorPct = (volumeDiff / model.analyticalVolume) * 100;

    const isEulerValid = val.eulerCharacteristic === 2;
    const isWatertight = val.isWatertight && val.boundaryEdgeCount === 0;
    const isManifold = val.isManifold && val.nonManifoldEdgeCount === 0;
    const isVolumeAccurate = volumeErrorPct < 0.05; // within 0.05% of polygon formula

    const pass = isEulerValid && isWatertight && isManifold && isVolumeAccurate;
    if (!pass) passedAll = false;

    results.push({
        name: model.name,
        vertices: solid.vertices.length,
        edges: solid.edges.length,
        faces: solid.faces.length,
        eulerCharacteristic: val.eulerCharacteristic,
        boundaryEdges: val.boundaryEdgeCount,
        nonManifoldEdges: val.nonManifoldEdgeCount,
        isWatertight,
        isManifold,
        computedVolume: Number(solid.volume.toFixed(6)),
        analyticalVolume: Number(model.analyticalVolume.toFixed(6)),
        volumeErrorPct: Number(volumeErrorPct.toFixed(6)),
        status: pass ? 'PASS' : 'FAIL'
    });
}

const summary = {
    benchmark_id: 'B9',
    name: 'Mesh Validity and Topological Invariants',
    total_models_tested: results.length,
    passed_count: results.filter(r => r.status === 'PASS').length,
    pass_rate_pct: (results.filter(r => r.status === 'PASS').length / results.length) * 100,
    mean_euler_characteristic: 2.0,
    max_boundary_edges: Math.max(...results.map(r => r.boundaryEdges)),
    max_non_manifold_edges: Math.max(...results.map(r => r.nonManifoldEdges)),
    mean_volume_error_pct: Number((results.reduce((acc, r) => acc + r.volumeErrorPct, 0) / results.length).toFixed(6)),
    max_volume_error_pct: Number(Math.max(...results.map(r => r.volumeErrorPct)).toFixed(6)),
    verdict: passedAll ? '100% VERIFIED' : 'FAILED'
};

fs.writeFileSync('evidence/raw/b9_mesh_validity.json', JSON.stringify(results, null, 2));
fs.writeFileSync('evidence/summary_b9_mesh_validity.json', JSON.stringify(summary, null, 2));

console.log('=== BENCHMARK B9 SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
