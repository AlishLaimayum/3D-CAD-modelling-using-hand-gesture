/**
 * GestureCAD Sensitivity Sweep: B4 (Pinch False Activations & Hysteresis Ablation)
 * Runs 6 noise levels x 30 seeds = 180 simulation runs.
 * Evaluates state flips between naive single-threshold and dual-threshold hysteresis.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function pseudoRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function runHysteresisTrial(noiseStd, seed, totalFrames = 2500) {
    const rng = pseudoRandom(seed);
    const signalBase = 0.49; // right in the hysteresis band [0.44, 0.54]

    // 1. Naive single threshold
    let naiveState = "IDLE";
    let naiveFlips = 0;
    const naiveThreshold = 0.48;

    // 2. Dual threshold with debouncing
    let hystState = "IDLE";
    let hystFlips = 0;
    const hystStart = 0.44;
    const hystRelease = 0.54;
    let pinchFrames = 0;
    let unpinchFrames = 0;

    for (let f = 0; f < totalFrames; f++) {
        const u1 = Math.max(1e-7, rng());
        const u2 = rng();
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const slowDrift = 0.03 * Math.sin(f * 0.005);
        const ratio = signalBase + slowDrift + z * noiseStd;

        // Naive evaluation
        const nextNaive = (ratio < naiveThreshold) ? "PINCH" : "IDLE";
        if (nextNaive !== naiveState) {
            naiveFlips++;
            naiveState = nextNaive;
        }

        // Hysteresis evaluation
        const rawPinch = ratio < hystStart;
        const rawRelease = ratio > hystRelease;

        if (rawPinch) {
            pinchFrames++;
            unpinchFrames = 0;
        } else if (rawRelease) {
            unpinchFrames++;
            pinchFrames = 0;
        }

        let nextHyst = hystState;
        if (hystState === "IDLE" && pinchFrames >= 1) {
            nextHyst = "PINCH";
        } else if (hystState === "PINCH" && unpinchFrames >= 2) {
            nextHyst = "IDLE";
        }

        if (nextHyst !== hystState) {
            hystFlips++;
            hystState = nextHyst;
        }
    }

    const flipReductionPct = naiveFlips > 0 ? ((naiveFlips - hystFlips) / naiveFlips) * 100 : 0;
    return {
        noiseStd,
        naiveFlips,
        hystFlips,
        flipReductionPct
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

const NOISE_LEVELS = [0.015, 0.030, 0.045, 0.060, 0.075, 0.090];
const NUM_SEEDS = 30;

console.log(`Running B4 sensitivity sweep: ${NOISE_LEVELS.length} noise levels x ${NUM_SEEDS} seeds = ${NOISE_LEVELS.length * NUM_SEEDS} trials...`);

const sweepResultsByLevel = {};
const allReductions = [];

for (const noise of NOISE_LEVELS) {
    const levelTrials = [];
    for (let s = 1; s <= NUM_SEEDS; s++) {
        const res = runHysteresisTrial(noise, s * 50 + Math.round(noise * 1000));
        levelTrials.push(res);
        allReductions.push(res.flipReductionPct);
    }

    sweepResultsByLevel[`noise_sigma_${noise}`] = {
        noise_sigma: noise,
        naive_flips: computeStats(levelTrials.map(t => t.naiveFlips)),
        hyst_flips: computeStats(levelTrials.map(t => t.hystFlips)),
        reduction_pct: computeStats(levelTrials.map(t => t.flipReductionPct))
    };
}

const aggregateStats = computeStats(allReductions);

const outputData = {
    benchmark_id: "B4_SENSITIVITY_SWEEP",
    provenance: "SIMULATED (Stochastic state walk within decision boundary)",
    sweep_parameters: {
        noise_sigmas_tested: NOISE_LEVELS,
        seeds_per_level: NUM_SEEDS,
        total_runs: NOISE_LEVELS.length * NUM_SEEDS,
        frames_per_trial: 2500
    },
    results_by_noise_level: sweepResultsByLevel,
    aggregate_reduction_pct: aggregateStats,
    verdict: `Across ${NOISE_LEVELS.length * NUM_SEEDS} runs (noise sigma 0.015-0.090), GestureCAD dual-threshold hysteresis reduced spurious state flips by ${aggregateStats.mean}% [95% CI: ${aggregateStats.ci95[0]}% - ${aggregateStats.ci95[1]}%, range: ${aggregateStats.min}% - ${aggregateStats.max}%]`
};

const outPath = path.join(__dirname, '..', 'summary_b4_sweep.json');
fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
console.log(`B4 sweep complete! Saved to ${outPath}`);
console.log(outputData.verdict);
