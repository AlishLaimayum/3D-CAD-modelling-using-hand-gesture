/**
 * smoothing.js - High-Performance 3D Position & Rotation Smoothing Engine
 * 
 * Provides low-latency, low-jitter 3D smoothing using Exponential Moving Average (EMA) / LERP
 * with dead-zone noise filtering, velocity clamping / outlier rejection, and state reset on gesture boundaries.
 */

export class PositionSmoother {
    /**
     * @param {Object} options
     * @param {number} [options.alpha=0.35] - LERP factor (0.0 to 1.0). Higher = faster response, Lower = smoother.
     * @param {number} [options.deadZone=0.003] - 3D distance below which movement is ignored to prevent resting tremor.
     * @param {number} [options.outlierThreshold=2.5] - Max 3D distance jump per frame. Jumps exceeding this are clamped.
     */
    constructor(options = {}) {
        this.alpha = options.alpha !== undefined ? options.alpha : 0.35;
        this.deadZone = options.deadZone !== undefined ? options.deadZone : 0.003;
        this.deadZoneSq = this.deadZone * this.deadZone;
        this.outlierThreshold = options.outlierThreshold !== undefined ? options.outlierThreshold : 2.5;
        this.outlierThresholdSq = this.outlierThreshold * this.outlierThreshold;
        
        this.current = null; // [x, y, z]
        this.velocity = [0, 0, 0];
    }

    /**
     * Configure smoothing parameters dynamically
     */
    configure({ alpha, deadZone, outlierThreshold }) {
        if (alpha !== undefined) this.alpha = alpha;
        if (deadZone !== undefined) {
            this.deadZone = deadZone;
            this.deadZoneSq = deadZone * deadZone;
        }
        if (outlierThreshold !== undefined) {
            this.outlierThreshold = outlierThreshold;
            this.outlierThresholdSq = outlierThreshold * outlierThreshold;
        }
    }

    /**
     * Reset the smoothing state. Crucial when starting or finishing strokes to prevent drag lag.
     * @param {Array<number>|null} initialPos
     */
    reset(initialPos = null) {
        if (initialPos) {
            this.current = [initialPos[0], initialPos[1], initialPos[2]];
        } else {
            this.current = null;
        }
        this.velocity = [0, 0, 0];
    }

    /**
     * Process a raw 3D position [x, y, z] through the smoothing pipeline.
     * @param {Array<number>} rawPos - Raw 3D coordinates [x, y, z]
     * @returns {Array<number>} Smoothed 3D coordinates [x, y, z]
     */
    update(rawPos) {
        if (!rawPos) return null;

        if (!this.current) {
            this.current = [rawPos[0], rawPos[1], rawPos[2]];
            return [...this.current];
        }

        const dx = rawPos[0] - this.current[0];
        const dy = rawPos[1] - this.current[1];
        const dz = rawPos[2] - this.current[2];
        const distSq = dx * dx + dy * dy + dz * dz;

        // 1. Dead-zone check (Micro-tremor filter)
        if (distSq < this.deadZoneSq) {
            return [...this.current];
        }

        // 2. Outlier rejection / clamp jump
        let targetX = rawPos[0];
        let targetY = rawPos[1];
        let targetZ = rawPos[2];

        if (distSq > this.outlierThresholdSq) {
            const dist = Math.sqrt(distSq);
            const scale = this.outlierThreshold / dist;
            targetX = this.current[0] + dx * scale;
            targetY = this.current[1] + dy * scale;
            targetZ = this.current[2] + dz * scale;
        }

        // 3. Dynamic alpha adjustment: slightly higher alpha during fast hand moves for zero perceived latency
        const speed = Math.sqrt(distSq);
        const dynamicAlpha = Math.min(1.0, this.alpha + Math.min(0.25, speed * 0.5));

        // 4. Exponential Moving Average LERP
        this.current[0] += (targetX - this.current[0]) * dynamicAlpha;
        this.current[1] += (targetY - this.current[1]) * dynamicAlpha;
        this.current[2] += (targetZ - this.current[2]) * dynamicAlpha;

        return [...this.current];
    }

    /**
     * Get current smoothed position
     */
    get() {
        return this.current ? [...this.current] : null;
    }
}

/**
 * Preconfigured Smoothing Presets for different CAD interaction modes:
 * - Cursor: High responsiveness, small deadzone
 * - Drawing: High stability for clean CAD paths, balanced deadzone
 * - Rotation: Ultra-smooth angular response
 */
export const SMOOTHING_PRESETS = {
    CURSOR: {
        alpha: 0.45,
        deadZone: 0.002,
        outlierThreshold: 3.0
    },
    DRAWING: {
        alpha: 0.55,
        deadZone: 0.001,
        outlierThreshold: 2.5
    },
    ROTATION: {
        alpha: 0.25,
        deadZone: 0.004,
        outlierThreshold: 2.0
    }
};
