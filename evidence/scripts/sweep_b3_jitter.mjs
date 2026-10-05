/**
 * GestureCAD Sensitivity Sweep: B3 (Cursor Jitter & Filter Ablation)
 * Runs 6 noise levels x 30 seeds = 180 simulation runs.
 * Computes mean, std, median, 95% CI, min, and max reduction across parameter space.
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

class PositionSmootherSimulator {
    constructor({ deadZone = true, adaptive = true, staticAlpha = 0.35 }) {
        this.deadZone = deadZone;
        this.adaptive = adaptive;
        this.staticAlpha = staticAlpha;
        this.deadZoneThresholdSq = 0.003 * 0.003; // 3 mm squared
        this.baseAlpha = 0.35;
        this.maxDisplacement = 2.5;
        this.currentPosition = null;
    }

    update(rawPos) {
        if (!this.currentPosition) {
            this.currentPosition = [...rawPos];
            return [...this.currentPosition];
        }

        const dx = rawPos[0] - this.currentPosition[0];
        const dy = rawPos[1] - this.currentPosition[1];
        const dz = rawPos[2] - this.currentPosition[2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (this.deadZone && distSq < this.deadZoneThresholdSq) {
            return [...this.currentPosition];
        }

        const dist = Math.sqrt(distSq);
        let clampedRaw = [...rawPos];
        if (dist > this.maxDisplacement) {
            const factor = this.maxDisplacement / dist;
            clampedRaw = [
                this.currentPosition[0] + dx * factor,
                this.currentPosition[1] + dy * factor,
                this.currentPosition[2] + dz * factor
            ];
        }

        let alpha = this.staticAlpha;
        if (this.adaptive) {
            const speed = dist;
            const velocityBonus = Math.min(0.25, 0.5 * speed);
            alpha = Math.min(1.0, this.baseAlpha + velocityBonus);
        }

        this.currentPosition = [
            this.currentPosition[0] + alpha * (clampedRaw[0] - this.currentPosition[0]),
            this.currentPosition[1] + alpha * (clampedRaw[1] - this.currentPosition[1]),
            this.currentPosition[2] + alpha * (clampedRaw[2] - this.currentPosition[2])
        ];

        return [...this.currentPosition];
    }
}

function runJitterTrial(noiseSigmaMeters, seed, sampleCount = 500) {
    const rng = pseudoRandom(seed);
    const truePos = [0.5, 1.0, -0.2];

    const smootherFull = new PositionSmootherSimulator({ deadZone: true, adaptive: true });
    const smootherDeadZoneOnly = new PositionSmootherSimulator({ deadZone: true, adaptive: false, staticAlpha: 1.0 });
    const smootherLerpOnly = new PositionSmootherSimulator({ deadZone: false, adaptive: false, staticAlpha: 0.35 });

    let rawSqSum = 0;
    let deadZoneSqSum = 0;
    let lerpOnlySqSum = 0;
    let fullSqSum = 0;

    for (let i = 0; i < sampleCount; i++) {
        const u1 = Math.max(1e-7, rng());
        const u2 = rng();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
        const z2 = (rng() - 0.5) * 2.0;

        const rawSample = [
            truePos[0] + z0 * noiseSigmaMeters,
            truePos[1] + z1 * noiseSigmaMeters,
            truePos[2] + z2 * noiseSigmaMeters
        ];

        const pDeadZone = smootherDeadZoneOnly.update(rawSample);
        const pLerp = smootherLerpOnly.update(rawSample);
        const pFull = smootherFull.update(rawSample);

        rawSqSum += (rawSample[0] - truePos[0]) ** 2 + (rawSample[1] - truePos[1]) ** 2 + (rawSample[2] - truePos[2]) ** 2;
        deadZoneSqSum += (pDeadZone[0] - truePos[0]) ** 2 + (pDeadZone[1] - truePos[1]) ** 2 + (pDeadZone[2] - truePos[2]) ** 2;
        lerpOnlySqSum += (pLerp[0] - truePos[0]) ** 2 + (pLerp[1] - truePos[1]) ** 2 + (pLerp[2] - truePos[2]) ** 2;
        fullSqSum += (pFull[0] - truePos[0]) ** 2 + (pFull[1] - truePos[1]) ** 2 + (pFull[2] - truePos[2]) ** 2;
    }

    const rawRmsMm = Math.sqrt(rawSqSum / sampleCount) * 1000;
    const deadZoneRmsMm = Math.sqrt(deadZoneSqSum / sampleCount) * 1000;
    const lerpRmsMm = Math.sqrt(lerpOnlySqSum / sampleCount) * 1000;
    const fullRmsMm = Math.sqrt(fullSqSum / sampleCount) * 1000;

    const fullReductionPct = ((rawRmsMm - fullRmsMm) / rawRmsMm) * 100;

    return {
        rawRmsMm,
        deadZoneRmsMm,
        lerpRmsMm,
        fullRmsMm,
        fullReductionPct
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
        mean: Number(mean.toFixed(3)),
        std: Number(std.toFixed(3)),
        median: Number(median.toFixed(3)),
        ci95: [Number((mean - 1.96 * sem).toFixed(3)), Number((mean + 1.96 * sem).toFixed(3))],
        min: Number(sorted[0].toFixed(3)),
        max: Number(sorted[n - 1].toFixed(3))
    };
}

const NOISE_LEVELS_MM = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
const NUM_SEEDS = 30;

console.log(`Running B3 sensitivity sweep: ${NOISE_LEVELS_MM.length} noise levels x ${NUM_SEEDS} seeds = ${NOISE_LEVELS_MM.length * NUM_SEEDS} trials...`);

const sweepResultsByLevel = {};
const allFullReductions = [];

for (const noiseMm of NOISE_LEVELS_MM) {
    const noiseMeters = noiseMm / 1000;
    const levelTrials = [];

    for (let seed = 1; seed <= NUM_SEEDS; seed++) {
        const res = runJitterTrial(noiseMeters, seed * 100 + Math.round(noiseMm * 10));
        levelTrials.push(res);
        allFullReductions.push(res.fullReductionPct);
    }

    sweepResultsByLevel[`noise_${noiseMm}mm`] = {
        noise_sigma_mm: noiseMm,
        raw_rms_mm: computeStats(levelTrials.map(t => t.rawRmsMm)),
        full_rms_mm: computeStats(levelTrials.map(t => t.fullRmsMm)),
        reduction_pct: computeStats(levelTrials.map(t => t.fullReductionPct))
    };
}

const aggregateStats = computeStats(allFullReductions);

const outputData = {
    benchmark_id: "B3_SENSITIVITY_SWEEP",
    provenance: "SIMULATED (Spectral/Gaussian physiological tremor model)",
    sweep_parameters: {
        noise_levels_tested_mm: NOISE_LEVELS_MM,
        seeds_per_level: NUM_SEEDS,
        total_runs: NOISE_LEVELS_MM.length * NUM_SEEDS,
        samples_per_trial: 500
    },
    results_by_noise_level: sweepResultsByLevel,
    aggregate_reduction_pct: aggregateStats,
    verdict: `Across ${NOISE_LEVELS_MM.length * NUM_SEEDS} runs (noise 1.0-6.0 mm), GestureCAD filter reduced RMS jitter by ${aggregateStats.mean}% [95% CI: ${aggregateStats.ci95[0]}% - ${aggregateStats.ci95[1]}%, range: ${aggregateStats.min}% - ${aggregateStats.max}%]`
};

const outPath = path.join(__dirname, '..', 'summary_b3_sweep.json');
fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
console.log(`B3 sweep complete! Saved to ${outPath}`);
console.log(outputData.verdict);
