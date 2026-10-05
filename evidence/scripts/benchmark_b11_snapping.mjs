/**
 * benchmark_b11_snapping.mjs
 * 
 * Benchmark B11: Snapping Engine Effectiveness
 * Evaluates geometric accuracy when targeting CAD feature points (vertices, midpoints, edge projections).
 * Compares:
 * 1. Raw unsnapped cursor distance to intended feature
 * 2. Snapped cursor distance to intended feature (magnetic capture)
 */

import fs from 'fs';
import { SnappingEngine } from '../../frontend/src/utils/snappingEngine.js';

function pseudoRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}
const rng = pseudoRandom(777);

const snappingEngine = new SnappingEngine({
    snapDistance: 0.25, // 0.25 units
    gridSize: 0.5,
    magneticLock: true,
    gridSnap: false,
    angleSnap: false
});

// Create scene with a box and a line
const cadObjects = [
    {
        id: 'box1',
        type: 'RECTANGLE',
        points: [[0, 0, 0], [4, 0, 0], [4, 0, 3], [0, 0, 3]]
    },
    {
        id: 'line1',
        type: 'LINE',
        start: [5, 0, 1],
        end: [8, 0, 4],
        points: [[5, 0, 1], [8, 0, 4]]
    }
];

// Target targets: vertices and midpoints
const targets = [
    [0, 0, 0], [4, 0, 0], [4, 0, 3], [0, 0, 3], // Box vertices
    [2, 0, 0], [4, 0, 1.5], [2, 0, 3], [0, 0, 1.5], // Box midpoints
    [5, 0, 1], [8, 0, 4], [6.5, 0, 2.5] // Line vertices and midpoint
];

const trialCount = 500;
let unsnappedTotalDist = 0;
let snappedTotalDist = 0;
let successfulSnaps = 0;

const trials = [];

for (let i = 0; i < trialCount; i++) {
    // Pick random target
    const target = targets[Math.floor(rng() * targets.length)];
    // Add human targeting inaccuracy (within 0.20 distance, within snap capture radius of 0.25)
    const errRadius = rng() * 0.20;
    const errAngle = rng() * Math.PI * 2;
    const rawPos = [
        target[0] + errRadius * Math.cos(errAngle),
        0,
        target[2] + errRadius * Math.sin(errAngle)
    ];

    const unsnappedDist = errRadius;

    // Apply snapping engine
    const snapResult = snappingEngine.snap(rawPos, cadObjects, null, null);
    const finalPos = snapResult.snappedPos;

    const snappedDist = Math.hypot(finalPos[0] - target[0], finalPos[2] - target[2]);

    unsnappedTotalDist += unsnappedDist;
    snappedTotalDist += snappedDist;

    if (snapResult.isSnapped) {
        successfulSnaps++;
    }

    if (i < 20) {
        trials.push({
            target,
            rawPos: [Number(rawPos[0].toFixed(3)), 0, Number(rawPos[2].toFixed(3))],
            snappedPos: [Number(finalPos[0].toFixed(3)), 0, Number(finalPos[2].toFixed(3))],
            snapType: snapResult.type,
            unsnappedDist: Number(unsnappedDist.toFixed(4)),
            snappedDist: Number(snappedDist.toFixed(4))
        });
    }
}

const meanUnsnapped = unsnappedTotalDist / trialCount;
const meanSnapped = snappedTotalDist / trialCount;
const errorReductionPct = ((meanUnsnapped - meanSnapped) / meanUnsnapped) * 100;

const summary = {
    benchmark_id: 'B11',
    name: 'Snapping Engine Effectiveness & Precision Improvement',
    trials_evaluated: trialCount,
    snap_radius: 0.25,
    successful_snap_rate_pct: Number(((successfulSnaps / trialCount) * 100).toFixed(2)),
    mean_unsnapped_error_m: Number(meanUnsnapped.toFixed(4)),
    mean_snapped_error_m: Number(meanSnapped.toFixed(4)),
    error_reduction_pct: Number(errorReductionPct.toFixed(2)),
    verdict: `Snapping reduced positional targeting error by ${errorReductionPct.toFixed(1)}% (capture rate ${((successfulSnaps / trialCount) * 100).toFixed(1)}%)`
};

fs.writeFileSync('evidence/raw/b11_snapping.json', JSON.stringify({ summary, sample_trials: trials }, null, 2));
fs.writeFileSync('evidence/summary_b11_snapping.json', JSON.stringify(summary, null, 2));

console.log('=== BENCHMARK B11 SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
