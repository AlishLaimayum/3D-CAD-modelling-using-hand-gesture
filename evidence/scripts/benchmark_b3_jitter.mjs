/**
 * benchmark_b3_jitter.mjs
 * 
 * Benchmark B3: Cursor Jitter & Filter Ablation Study
 * Evaluates cursor stability during a stationary 10-second hand hold (300 frames at 30 Hz).
 * Compares 4 configurations:
 * 1. Raw (Unfiltered)
 * 2. Dead-Zone Only (threshold = 0.003 m)
 * 3. Static LERP Only (alpha = 0.35, no dead-zone)
 * 4. Full GestureCAD (Dead-Zone + Velocity-Adaptive LERP)
 */

import fs from 'fs';
import { PositionSmoother } from '../../frontend/src/utils/smoothing.js';

function pseudoRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}
const rng = pseudoRandom(1234);

// Simulate stationary hand at [1.0, 1.5, -0.5] with physiological tremor
// Spectral tremor model: 8-12 Hz oscillation + Gaussian noise
const truePos = [1.0, 1.5, -0.5];
const sampleCount = 1000;
const rawTrajectory = [];

for (let i = 0; i < sampleCount; i++) {
    const t = i / 30.0; // 30 FPS
    // 10 Hz tremor component (~2 mm amplitude)
    const tremorX = 0.002 * Math.sin(2 * Math.PI * 10 * t);
    const tremorY = 0.002 * Math.cos(2 * Math.PI * 8.5 * t);
    const tremorZ = 0.0015 * Math.sin(2 * Math.PI * 11 * t);

    // Optical tracking white noise (~1.5 mm sigma)
    const u1 = Math.max(1e-6, rng());
    const u2 = rng();
    const gNoise1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * 0.0015;
    const gNoise2 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2) * 0.0015;
    const gNoise3 = (rng() - 0.5) * 0.002;

    rawTrajectory.push([
        truePos[0] + tremorX + gNoise1,
        truePos[1] + tremorY + gNoise2,
        truePos[2] + tremorZ + gNoise3
    ]);
}

// 1. Raw
const rawResults = rawTrajectory;

// 2. Dead-zone only (alpha = 1.0, deadZone = 0.003)
const deadZoneFilter = new PositionSmoother({ alpha: 1.0, deadZone: 0.003, outlierThreshold: 2.5 });
const deadZoneResults = rawTrajectory.map(pt => deadZoneFilter.update(pt));

// 3. Static LERP only (alpha = 0.35, deadZone = 0.0)
const staticLerpFilter = new PositionSmoother({ alpha: 0.35, deadZone: 0.0, outlierThreshold: 2.5 });
const staticLerpResults = rawTrajectory.map(pt => staticLerpFilter.update(pt));

// 4. Full GestureCAD (alpha = 0.35, deadZone = 0.003, velocity-adaptive)
const fullFilter = new PositionSmoother({ alpha: 0.35, deadZone: 0.003, outlierThreshold: 2.5 });
const fullResults = rawTrajectory.map(pt => fullFilter.update(pt));

function computeMetrics(pts) {
    const N = pts.length;
    let meanX = 0, meanY = 0, meanZ = 0;
    for (const p of pts) { meanX += p[0]; meanY += p[1]; meanZ += p[2]; }
    meanX /= N; meanY /= N; meanZ /= N;

    let sumDistSq = 0;
    let maxDist = 0;
    for (const p of pts) {
        const d = Math.hypot(p[0] - meanX, p[1] - meanY, p[2] - meanZ);
        sumDistSq += d * d;
        if (d > maxDist) maxDist = d;
    }
    const rmsJitter = Math.sqrt(sumDistSq / N);
    return {
        rmsJitterMm: Number((rmsJitter * 1000).toFixed(3)),
        maxJitterMm: Number((maxDist * 1000).toFixed(3))
    };
}

const rawMetrics = computeMetrics(rawResults);
const deadZoneMetrics = computeMetrics(deadZoneResults);
const staticLerpMetrics = computeMetrics(staticLerpResults);
const fullMetrics = computeMetrics(fullResults);

const jitterReductionPct = ((rawMetrics.rmsJitterMm - fullMetrics.rmsJitterMm) / rawMetrics.rmsJitterMm) * 100;

const summary = {
    benchmark_id: 'B3',
    name: 'Cursor Jitter & Filter Ablation Study',
    sample_count: sampleCount,
    configurations: {
        raw_unfiltered: {
            rms_jitter_mm: rawMetrics.rmsJitterMm,
            max_jitter_mm: rawMetrics.maxJitterMm
        },
        dead_zone_only: {
            rms_jitter_mm: deadZoneMetrics.rmsJitterMm,
            max_jitter_mm: deadZoneMetrics.maxJitterMm,
            rms_reduction_pct: Number((((rawMetrics.rmsJitterMm - deadZoneMetrics.rmsJitterMm) / rawMetrics.rmsJitterMm) * 100).toFixed(2))
        },
        static_lerp_only: {
            rms_jitter_mm: staticLerpMetrics.rmsJitterMm,
            max_jitter_mm: staticLerpMetrics.maxJitterMm,
            rms_reduction_pct: Number((((rawMetrics.rmsJitterMm - staticLerpMetrics.rmsJitterMm) / rawMetrics.rmsJitterMm) * 100).toFixed(2))
        },
        full_gesturecad: {
            rms_jitter_mm: fullMetrics.rmsJitterMm,
            max_jitter_mm: fullMetrics.maxJitterMm,
            rms_reduction_pct: Number(jitterReductionPct.toFixed(2))
        }
    },
    verdict: `Full filter achieves ${jitterReductionPct.toFixed(1)}% reduction in RMS jitter (${rawMetrics.rmsJitterMm} mm -> ${fullMetrics.rmsJitterMm} mm)`
};

fs.writeFileSync('evidence/raw/b3_jitter.json', JSON.stringify({
    summary,
    sample_raw: rawResults.slice(0, 100),
    sample_full: fullResults.slice(0, 100)
}, null, 2));

fs.writeFileSync('evidence/summary_b3_jitter.json', JSON.stringify(summary, null, 2));

console.log('=== BENCHMARK B3 SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
