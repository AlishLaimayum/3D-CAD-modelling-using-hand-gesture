/**
 * benchmark_b4_hysteresis.mjs
 * 
 * Benchmark B4: Pinch False Activations & Hysteresis Ablation
 * Evaluates state stability when hand is hovering near the pinch decision boundary:
 * Compares:
 * 1. Naive single threshold (threshold = 0.48)
 * 2. Dual-threshold hysteresis (GestureCAD: start = 0.44, release = 0.54, debounced)
 */

import fs from 'fs';

// Seeded pseudorandom generator for deterministic reproducibility
function pseudoRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

const rng = pseudoRandom(42);

// Generate 5000 frames of noisy pinch ratio hovering near boundary
const totalFrames = 5000;
const signalBase = 0.49; // hovering right around the threshold
const noiseStd = 0.045; // resting physiological hand tremor

const trajectory = [];
for (let i = 0; i < totalFrames; i++) {
    // Box-Muller transform for Gaussian noise
    const u1 = Math.max(1e-6, rng());
    const u2 = rng();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    // Add slow intentional drift + high-frequency noise
    const slowDrift = 0.04 * Math.sin((i / 500) * Math.PI * 2);
    const ratio = signalBase + slowDrift + z * noiseStd;
    trajectory.push(ratio);
}

// 1. Simulation of Naive Single Threshold
class NaiveClassifier {
    constructor(threshold = 0.48) {
        this.threshold = threshold;
        this.state = 'IDLE';
        this.flips = 0;
        this.history = [];
    }
    update(ratio) {
        const nextState = ratio < this.threshold ? 'PINCH' : 'IDLE';
        if (nextState !== this.state) {
            this.flips++;
            this.state = nextState;
        }
        this.history.push(this.state);
        return this.state;
    }
}

// 2. Simulation of GestureCAD Dual-Threshold Hysteresis State Machine
class HysteresisClassifier {
    constructor(startThreshold = 0.44, releaseThreshold = 0.54, startDebounce = 1, releaseDebounce = 2) {
        this.startThreshold = startThreshold;
        this.releaseThreshold = releaseThreshold;
        this.startDebounce = startDebounce;
        this.releaseDebounce = releaseDebounce;
        this.state = 'IDLE';
        this.isPinching = false;
        this.pinchFrames = 0;
        this.unpinchFrames = 0;
        this.flips = 0;
        this.history = [];
    }
    update(ratio) {
        const prev = this.state;
        if (!this.isPinching) {
            if (ratio < this.startThreshold) {
                this.pinchFrames++;
                this.unpinchFrames = 0;
                if (this.pinchFrames >= this.startDebounce) {
                    this.isPinching = true;
                    this.state = 'PINCH';
                }
            } else {
                this.pinchFrames = 0;
            }
        } else {
            if (ratio > this.releaseThreshold) {
                this.unpinchFrames++;
                if (this.unpinchFrames >= this.releaseDebounce) {
                    this.isPinching = false;
                    this.state = 'IDLE';
                    this.pinchFrames = 0;
                }
            } else {
                this.unpinchFrames = 0;
            }
        }

        if (this.state !== prev) {
            this.flips++;
        }
        this.history.push(this.state);
        return this.state;
    }
}

const naive = new NaiveClassifier(0.48);
const hyst = new HysteresisClassifier(0.44, 0.54, 1, 2);

trajectory.forEach(ratio => {
    naive.update(ratio);
    hyst.update(ratio);
});

const flipReductionPct = ((naive.flips - hyst.flips) / naive.flips) * 100;

const summary = {
    benchmark_id: 'B4',
    name: 'Pinch False Activations & Hysteresis Ablation',
    total_frames_tested: totalFrames,
    noise_sigma: noiseStd,
    naive_threshold: 0.48,
    naive_state_flips: naive.flips,
    naive_flip_rate_per_100_frames: Number(((naive.flips / totalFrames) * 100).toFixed(2)),
    hysteresis_start_threshold: 0.44,
    hysteresis_release_threshold: 0.54,
    hysteresis_state_flips: hyst.flips,
    hysteresis_flip_rate_per_100_frames: Number(((hyst.flips / totalFrames) * 100).toFixed(2)),
    flip_reduction_percent: Number(flipReductionPct.toFixed(2)),
    verdict: `${flipReductionPct.toFixed(1)}% reduction in spurious state transitions`
};

fs.writeFileSync('evidence/raw/b4_hysteresis.json', JSON.stringify({
    summary,
    sample_trajectory: trajectory.slice(0, 200),
    sample_naive_history: naive.history.slice(0, 200),
    sample_hyst_history: hyst.history.slice(0, 200)
}, null, 2));

fs.writeFileSync('evidence/summary_b4_hysteresis.json', JSON.stringify(summary, null, 2));

console.log('=== BENCHMARK B4 SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
