/**
 * benchmark_b10_shape_recognition.mjs
 * 
 * Benchmark B10: Shape Regularization Accuracy
 * Tests recognizeShape() against 200 freehand strokes with human-like noise:
 * - 50 Lines (straight lines with lateral deviation)
 * - 50 Circles (ellipticity / radius perturbations)
 * - 50 Rectangles (corner rounding, aspect ratios)
 * - 50 Triangles (3-corner closed curves)
 * Computes confusion matrix, precision, recall, and overall accuracy.
 */

import fs from 'fs';
import { recognizeShape } from '../../frontend/src/utils/shapeRecognizer.js';

function pseudoRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}
const rng = pseudoRandom(999);

const categories = ['LINE', 'CIRCLE', 'RECTANGLE', 'TRIANGLE'];
const dataset = [];

// 1. Generate 50 noisy lines
for (let i = 0; i < 50; i++) {
    const len = 3 + rng() * 4;
    const angle = rng() * Math.PI * 2;
    const pts = [];
    const count = 20;
    for (let j = 0; j < count; j++) {
        const frac = j / (count - 1);
        const lateralNoise = (rng() - 0.5) * 0.08;
        const x = frac * len * Math.cos(angle) - lateralNoise * Math.sin(angle);
        const z = frac * len * Math.sin(angle) + lateralNoise * Math.cos(angle);
        pts.push([x, 0, z]);
    }
    dataset.push({ label: 'LINE', points: pts });
}

// 2. Generate 50 noisy circles
for (let i = 0; i < 50; i++) {
    const r = 1.5 + rng() * 1.5;
    const count = 35;
    const pts = [];
    for (let j = 0; j <= count; j++) {
        const a = (j / count) * Math.PI * 2;
        const rPerturb = r + (rng() - 0.5) * 0.12 * r;
        pts.push([rPerturb * Math.cos(a), 0, rPerturb * Math.sin(a)]);
    }
    dataset.push({ label: 'CIRCLE', points: pts });
}

// 3. Generate 50 noisy rectangles
for (let i = 0; i < 50; i++) {
    const w = 2 + rng() * 3;
    const d = 1.5 + rng() * 2;
    const corners = [
        [0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d], [0, 0, 0]
    ];
    const pts = [];
    for (let c = 0; c < 4; c++) {
        const c1 = corners[c];
        const c2 = corners[c + 1];
        const segPoints = 8;
        for (let k = 0; k < segPoints; k++) {
            const f = k / segPoints;
            const x = c1[0] + f * (c2[0] - c1[0]) + (rng() - 0.5) * 0.08;
            const z = c1[2] + f * (c2[2] - c1[2]) + (rng() - 0.5) * 0.08;
            pts.push([x, 0, z]);
        }
    }
    pts.push([...pts[0]]);
    dataset.push({ label: 'RECTANGLE', points: pts });
}

// 4. Generate 50 noisy triangles
for (let i = 0; i < 50; i++) {
    const side = 2.5 + rng() * 2;
    const corners = [
        [0, 0, 0], [side, 0, 0], [side / 2, 0, (Math.sqrt(3) / 2) * side], [0, 0, 0]
    ];
    const pts = [];
    for (let c = 0; c < 3; c++) {
        const c1 = corners[c];
        const c2 = corners[c + 1];
        const segPoints = 10;
        for (let k = 0; k < segPoints; k++) {
            const f = k / segPoints;
            const x = c1[0] + f * (c2[0] - c1[0]) + (rng() - 0.5) * 0.08;
            const z = c1[2] + f * (c2[2] - c1[2]) + (rng() - 0.5) * 0.08;
            pts.push([x, 0, z]);
        }
    }
    pts.push([...pts[0]]);
    dataset.push({ label: 'TRIANGLE', points: pts });
}

// Confusion matrix: [actual][predicted]
const matrix = {};
const classes = ['LINE', 'CIRCLE', 'RECTANGLE', 'TRIANGLE', 'NONE'];
classes.forEach(c1 => {
    matrix[c1] = {};
    classes.forEach(c2 => matrix[c1][c2] = 0);
});

let correct = 0;
dataset.forEach(item => {
    const res = recognizeShape(item.points);
    let pred = res.shape;
    if (pred === 'SQUARE') pred = 'RECTANGLE'; // Group squares with rectangles
    if (!pred || !classes.includes(pred)) pred = 'NONE';

    matrix[item.label][pred]++;
    if (pred === item.label) correct++;
});

const overallAccuracy = (correct / dataset.length) * 100;

// Per-class metrics
const perClass = {};
categories.forEach(cls => {
    const tp = matrix[cls][cls];
    let fp = 0;
    classes.forEach(other => {
        if (other !== cls) fp += matrix[other][cls];
    });
    let fn = 0;
    classes.forEach(other => {
        if (other !== cls) fn += matrix[cls][other];
    });

    const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
    const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    perClass[cls] = {
        true_positives: tp,
        false_positives: fp,
        false_negatives: fn,
        precision_pct: Number(precision.toFixed(2)),
        recall_pct: Number(recall.toFixed(2)),
        f1_score: Number(f1.toFixed(2))
    };
});

const summary = {
    benchmark_id: 'B10',
    name: 'Shape Regularization & Heuristic Recognition Accuracy',
    dataset_size: dataset.length,
    overall_accuracy_pct: Number(overallAccuracy.toFixed(2)),
    confusion_matrix: matrix,
    per_class_metrics: perClass,
    verdict: `Overall recognition accuracy of ${overallAccuracy.toFixed(1)}% across 200 strokes`
};

fs.writeFileSync('evidence/raw/b10_shape_recognition.json', JSON.stringify({ summary, matrix }, null, 2));
fs.writeFileSync('evidence/summary_b10_shape_recognition.json', JSON.stringify(summary, null, 2));

console.log('=== BENCHMARK B10 SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
