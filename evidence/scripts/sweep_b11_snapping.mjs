/**
 * GestureCAD Sensitivity Sweep: B11 (Geometric Snapping Effectiveness & Precision)
 * Evaluates SnappingEngine.snap() across 6 targeting dispersion levels x 30 seeds = 180 runs (36,000 queries).
 * Computes capture rate and error reduction confidence intervals.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { SnappingEngine } from '../../frontend/src/utils/snappingEngine.js';

function pseudoRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function runSnappingTrial(targetingNoiseRadius, seed, numQueries = 200, snapDistance = 0.25) {
    const rng = pseudoRandom(seed);
    const snappingEngine = new SnappingEngine({
        snapDistance: snapDistance,
        gridSize: 0.5,
        magneticLock: true,
        gridSnap: false,
        angleSnap: false
    });

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

    const targets = [
        [0, 0, 0], [4, 0, 0], [4, 0, 3], [0, 0, 3],
        [2, 0, 0], [4, 0, 1.5], [2, 0, 3], [0, 0, 1.5],
        [5, 0, 1], [8, 0, 4], [6.5, 0, 2.5]
    ];

    let totalUnsnappedDist = 0;
    let totalSnappedDist = 0;
    let successfulSnaps = 0;

    for (let i = 0; i < numQueries; i++) {
        const target = targets[Math.floor(rng() * targets.length)];
        const errRadius = rng() * targetingNoiseRadius;
        const errAngle = rng() * Math.PI * 2;

        const rawPos = [
            target[0] + errRadius * Math.cos(errAngle),
            0,
            target[2] + errRadius * Math.sin(errAngle)
        ];

        const unsnappedDist = errRadius;
        const snapResult = snappingEngine.snap(rawPos, cadObjects, null, null);
        const finalPos = snapResult.snappedPos;

        const snappedDist = Math.hypot(finalPos[0] - target[0], finalPos[2] - target[2]);

        totalUnsnappedDist += unsnappedDist;
        totalSnappedDist += snappedDist;

        if (snapResult.isSnapped) {
            successfulSnaps++;
        }
    }

    const meanUnsnapped = totalUnsnappedDist / numQueries;
    const meanSnapped = totalSnappedDist / numQueries;
    const captureRatePct = (successfulSnaps / numQueries) * 100;
    const errorReductionPct = meanUnsnapped > 0 ? ((meanUnsnapped - meanSnapped) / meanUnsnapped) * 100 : 0;

    return {
        targetingNoiseRadius,
        captureRatePct,
        errorReductionPct,
        meanUnsnapped,
        meanSnapped
    };
}

function computeStats(arr) {
    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);
    const sem = std / Math.sqrt(n);
    const sorted = [...arr].sort((a, b) => a - b);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    return {
        mean: Number(mean.toFixed(2)),
        std: Number(std.toFixed(2)),
        median: Number(median.toFixed(2)),
        ci95: [Number((mean - 1.96 * sem).toFixed(2)), Number((mean + 1.96 * sem).toFixed(2))],
        min: Number(sorted[0].toFixed(2)),
        max: Number(sorted[n - 1].toFixed(2))
    };
}

const NOISE_LEVELS = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35];
const NUM_SEEDS = 30;

console.log(`Running B11 sensitivity sweep: ${NOISE_LEVELS.length} noise levels x ${NUM_SEEDS} seeds = ${NOISE_LEVELS.length * NUM_SEEDS} trials (${NOISE_LEVELS.length * NUM_SEEDS * 200} queries)...`);

const sweepResultsByLevel = {};
const allReductions = [];
const allCaptures = [];

for (const noise of NOISE_LEVELS) {
    const levelTrials = [];
    for (let s = 1; s <= NUM_SEEDS; s++) {
        const res = runSnappingTrial(noise, s * 80 + Math.round(noise * 1000));
        levelTrials.push(res);
        allReductions.push(res.errorReductionPct);
        allCaptures.push(res.captureRatePct);
    }

    sweepResultsByLevel[`noise_${noise}`] = {
        noise_radius_limit: noise,
        capture_rate_pct: computeStats(levelTrials.map(t => t.captureRatePct)),
        error_reduction_pct: computeStats(levelTrials.map(t => t.errorReductionPct)),
        mean_unsnapped_error: computeStats(levelTrials.map(t => t.meanUnsnapped)),
        mean_snapped_error: computeStats(levelTrials.map(t => t.meanSnapped))
    };
}

const aggregateReduction = computeStats(allReductions);
const aggregateCapture = computeStats(allCaptures);

const outputData = {
    benchmark_id: "B11_SENSITIVITY_SWEEP",
    provenance: "SIMULATED (Stochastic targeting queries against active CAD polygon)",
    sweep_parameters: {
        noise_radii_tested: NOISE_LEVELS,
        seeds_per_level: NUM_SEEDS,
        total_runs: NOISE_LEVELS.length * NUM_SEEDS,
        queries_per_run: 200,
        total_queries: NOISE_LEVELS.length * NUM_SEEDS * 200,
        snap_distance_threshold: 0.25
    },
    results_by_noise_level: sweepResultsByLevel,
    aggregate_error_reduction: aggregateReduction,
    aggregate_capture_rate: aggregateCapture,
    verdict: `Across ${NOISE_LEVELS.length * NUM_SEEDS} runs (targeting dispersion 0.10-0.35, snap radius 0.25), snapping captured ${aggregateCapture.mean}% [95% CI: ${aggregateCapture.ci95[0]}% - ${aggregateCapture.ci95[1]}%, range: ${aggregateCapture.min}% - ${aggregateCapture.max}%], reducing positional targeting error by ${aggregateReduction.mean}% [95% CI: ${aggregateReduction.ci95[0]}% - ${aggregateReduction.ci95[1]}%, range: ${aggregateReduction.min}% - ${aggregateReduction.max}%].`
};

const outPath = path.join(__dirname, '..', 'summary_b11_sweep.json');
fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
console.log(`B11 sweep complete! Saved to ${outPath}`);
console.log(outputData.verdict);
