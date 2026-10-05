/**
 * GestureCAD Sensitivity Sweep: B10 (Shape Recognition Accuracy vs Stroke Distortion)
 * Evaluates recognizeShape() across 6 noise/distortion levels x 30 seeds = 180 runs (18,000 strokes).
 * Quantifies recognition accuracy and bounds of the heuristic classifier.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { recognizeShape } from '../../frontend/src/utils/shapeRecognizer.js';

function pseudoRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function generateNoisyStroke(shapeType, noiseLevel, rng) {
    const pts = [];

    if (shapeType === "LINE") {
        const len = 3 + rng() * 4;
        const angle = rng() * Math.PI * 2;
        const count = 20;
        for (let j = 0; j < count; j++) {
            const frac = j / (count - 1);
            const lateralNoise = (rng() - 0.5) * noiseLevel;
            const x = frac * len * Math.cos(angle) - lateralNoise * Math.sin(angle);
            const z = frac * len * Math.sin(angle) + lateralNoise * Math.cos(angle);
            pts.push([x, 0, z]);
        }
    } else if (shapeType === "CIRCLE") {
        const r = 1.5 + rng() * 1.5;
        const count = 35;
        for (let j = 0; j <= count; j++) {
            const a = (j / count) * Math.PI * 2;
            const rPerturb = r + (rng() - 0.5) * noiseLevel * r;
            pts.push([rPerturb * Math.cos(a), 0, rPerturb * Math.sin(a)]);
        }
    } else if (shapeType === "RECTANGLE") {
        const w = 2 + rng() * 3;
        const d = 1.5 + rng() * 2;
        const corners = [
            [0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d], [0, 0, 0]
        ];
        const segPoints = 8;
        for (let c = 0; c < 4; c++) {
            const c1 = corners[c];
            const c2 = corners[c + 1];
            for (let k = 0; k < segPoints; k++) {
                const f = k / segPoints;
                const x = c1[0] + f * (c2[0] - c1[0]) + (rng() - 0.5) * noiseLevel;
                const z = c1[2] + f * (c2[2] - c1[2]) + (rng() - 0.5) * noiseLevel;
                pts.push([x, 0, z]);
            }
        }
        pts.push([...pts[0]]);
    } else if (shapeType === "TRIANGLE") {
        const side = 2.5 + rng() * 2;
        const corners = [
            [0, 0, 0], [side, 0, 0], [side / 2, 0, (Math.sqrt(3) / 2) * side], [0, 0, 0]
        ];
        const segPoints = 10;
        for (let c = 0; c < 3; c++) {
            const c1 = corners[c];
            const c2 = corners[c + 1];
            for (let k = 0; k < segPoints; k++) {
                const f = k / segPoints;
                const x = c1[0] + f * (c2[0] - c1[0]) + (rng() - 0.5) * noiseLevel;
                const z = c1[2] + f * (c2[2] - c1[2]) + (rng() - 0.5) * noiseLevel;
                pts.push([x, 0, z]);
            }
        }
        pts.push([...pts[0]]);
    }
    return pts;
}

function runShapeSweepTrial(noiseLevel, seed) {
    const rng = pseudoRandom(seed);
    const classes = ["LINE", "CIRCLE", "RECTANGLE", "TRIANGLE"];
    const strokesPerClass = 25; // 100 strokes per run

    let totalCorrect = 0;
    let totalTested = 0;
    const classCorrect = { LINE: 0, CIRCLE: 0, RECTANGLE: 0, TRIANGLE: 0 };

    for (const shape of classes) {
        for (let i = 0; i < strokesPerClass; i++) {
            const stroke = generateNoisyStroke(shape, noiseLevel, rng);
            const res = recognizeShape(stroke);
            let pred = res ? res.shape : 'NONE';
            if (pred === 'SQUARE') pred = 'RECTANGLE';

            totalTested++;
            if (pred === shape) {
                totalCorrect++;
                classCorrect[shape]++;
            }
        }
    }

    return {
        noiseLevel,
        overallAccuracyPct: (totalCorrect / totalTested) * 100,
        perClassAccuracyPct: {
            LINE: (classCorrect.LINE / strokesPerClass) * 100,
            CIRCLE: (classCorrect.CIRCLE / strokesPerClass) * 100,
            RECTANGLE: (classCorrect.RECTANGLE / strokesPerClass) * 100,
            TRIANGLE: (classCorrect.TRIANGLE / strokesPerClass) * 100
        }
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

const NOISE_LEVELS = [0.04, 0.08, 0.12, 0.16, 0.20, 0.25];
const NUM_SEEDS = 30;

console.log(`Running B10 sensitivity sweep: ${NOISE_LEVELS.length} noise levels x ${NUM_SEEDS} seeds = ${NOISE_LEVELS.length * NUM_SEEDS} trials (${NOISE_LEVELS.length * NUM_SEEDS * 100} strokes)...`);

const sweepResultsByLevel = {};

for (const noise of NOISE_LEVELS) {
    const levelTrials = [];
    for (let s = 1; s <= NUM_SEEDS; s++) {
        const res = runShapeSweepTrial(noise, s * 70 + Math.round(noise * 1000));
        levelTrials.push(res);
    }

    sweepResultsByLevel[`noise_${noise}`] = {
        noise_level: noise,
        overall_accuracy: computeStats(levelTrials.map(t => t.overallAccuracyPct)),
        line_accuracy: computeStats(levelTrials.map(t => t.perClassAccuracyPct.LINE)),
        circle_accuracy: computeStats(levelTrials.map(t => t.perClassAccuracyPct.CIRCLE)),
        rectangle_accuracy: computeStats(levelTrials.map(t => t.perClassAccuracyPct.RECTANGLE)),
        triangle_accuracy: computeStats(levelTrials.map(t => t.perClassAccuracyPct.TRIANGLE))
    };
}

const outputData = {
    benchmark_id: "B10_SENSITIVITY_SWEEP",
    provenance: "SIMULATED (Heuristic classifier against synthetic distorted strokes)",
    sweep_parameters: {
        noise_levels_tested: NOISE_LEVELS,
        seeds_per_level: NUM_SEEDS,
        total_runs: NOISE_LEVELS.length * NUM_SEEDS,
        strokes_per_run: 100,
        total_strokes_evaluated: NOISE_LEVELS.length * NUM_SEEDS * 100
    },
    results_by_noise_level: sweepResultsByLevel,
    verdict: `Evaluated ${NOISE_LEVELS.length * NUM_SEEDS * 100} strokes across noise levels 0.04-0.25. Under low noise (0.04-0.08), mean accuracy is ${sweepResultsByLevel['noise_0.04'].overall_accuracy.mean}% - ${sweepResultsByLevel['noise_0.08'].overall_accuracy.mean}%; under moderate noise (0.12-0.16), accuracy is ${sweepResultsByLevel['noise_0.12'].overall_accuracy.mean}% - ${sweepResultsByLevel['noise_0.16'].overall_accuracy.mean}%; under extreme distortion (0.20-0.25), accuracy degrades to ${sweepResultsByLevel['noise_0.2'].overall_accuracy.mean}% - ${sweepResultsByLevel['noise_0.25'].overall_accuracy.mean}%.`
};

const outPath = path.join(__dirname, '..', 'summary_b10_sweep.json');
fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
console.log(`B10 sweep complete! Saved to ${outPath}`);
console.log(outputData.verdict);
