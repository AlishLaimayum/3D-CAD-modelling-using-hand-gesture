/**
 * gestureStateMachine.js - Gesture State Machine with Hysteresis
 * 
 * Prevents rapid flickering between gesture states using dual-threshold hysteresis
 * and debounces state transitions to ensure rock-solid CAD drawing and plane manipulation.
 */

export const GestureStates = {
    IDLE: 'IDLE',
    PINCH_START: 'PINCH_START',
    DRAWING: 'DRAWING',
    PINCH_RELEASE: 'PINCH_RELEASE',
    OPEN_PALM_START: 'OPEN_PALM_START',
    ROTATING: 'ROTATING',
    OPEN_PALM_RELEASE: 'OPEN_PALM_RELEASE',
    FIST: 'FIST'
};

export class GestureStateMachine {
    /**
     * @param {Object} [options]
     * @param {number} [options.pinchStartThreshold=0.44] - Pinch ratio below which pinch begins
     * @param {number} [options.pinchReleaseThreshold=0.54] - Pinch ratio above which pinch ends
     * @param {number} [options.pinchDebounceFrames=1] - Consecutive frames required to enter pinch
     * @param {number} [options.unpinchDebounceFrames=2] - Consecutive frames required to exit pinch
     */
    constructor(options = {}) {
        this.pinchStartThreshold = options.pinchStartThreshold || 0.44;
        this.pinchReleaseThreshold = options.pinchReleaseThreshold || 0.54;
        this.pinchDebounceFrames = options.pinchDebounceFrames || 1;
        this.unpinchDebounceFrames = options.unpinchDebounceFrames || 2;

        this.currentState = GestureStates.IDLE;
        this.isPinching = false;
        this.isPalmRotating = false;

        this.pinchFrames = 0;
        this.unpinchFrames = 0;

        // Callback hooks for state transitions
        this.onPinchStart = null;
        this.onDrawing = null;
        this.onPinchRelease = null;
        this.onPalmStart = null;
        this.onRotating = null;
        this.onPalmRelease = null;
        this.onStateChange = null;
    }

    /**
     * Process a tracking frame packet from the backend.
     * @param {Object} packet - Raw tracking packet from WebSocket
     * @param {string} packet.state - State from backend ('IDLE', 'PINCH', 'OPEN_PALM', 'FIST')
     * @param {boolean} packet.locked - Whether the working plane is locked
     * @param {number} [packet.pinch_ratio] - Ratio of thumb-index distance to hand size
     * @returns {string} Effective current gesture state
     */
    update(packet) {
        if (!packet) return this.currentState;

        const rawState = packet.state;
        const isLocked = !!packet.locked;
        const pinchRatio = packet.pinch_ratio !== undefined ? packet.pinch_ratio : null;

        const prevState = this.currentState;

        // ----------------------------------------------------
        // 1. PINCH HYSTERESIS LOGIC
        // ----------------------------------------------------
        let evaluatedPinch = false;
        if (pinchRatio !== null) {
            if (!this.isPinching) {
                // To enter pinch: distance must be less than start threshold
                if (pinchRatio < this.pinchStartThreshold || rawState === 'PINCH') {
                    this.pinchFrames++;
                    this.unpinchFrames = 0;
                    if (this.pinchFrames >= this.pinchDebounceFrames) {
                        evaluatedPinch = true;
                    }
                } else {
                    this.pinchFrames = 0;
                }
            } else {
                // Already pinching: stay pinching until distance exceeds release threshold
                if (pinchRatio > this.pinchReleaseThreshold && rawState !== 'PINCH') {
                    this.unpinchFrames++;
                    if (this.unpinchFrames >= this.unpinchDebounceFrames) {
                        evaluatedPinch = false;
                        this.pinchFrames = 0;
                    } else {
                        evaluatedPinch = true; // Hold pinch during release debounce
                    }
                } else {
                    this.unpinchFrames = 0;
                    evaluatedPinch = true;
                }
            }
        } else {
            evaluatedPinch = rawState === 'PINCH';
        }

        // ----------------------------------------------------
        // 2. STATE MACHINE TRANSITIONS
        // ----------------------------------------------------
        if (evaluatedPinch && isLocked) {
            // Pinch is active while plane is locked -> Drawing mode
            if (!this.isPinching) {
                this.isPinching = true;
                this.currentState = GestureStates.PINCH_START;
                if (this.onPinchStart) this.onPinchStart();
            } else {
                this.currentState = GestureStates.DRAWING;
                if (this.onDrawing) this.onDrawing();
            }

            if (this.isPalmRotating) {
                this.isPalmRotating = false;
                if (this.onPalmRelease) this.onPalmRelease();
            }
        } else if (this.isPinching) {
            // Pinch just ended
            this.isPinching = false;
            this.currentState = GestureStates.PINCH_RELEASE;
            if (this.onPinchRelease) this.onPinchRelease();
            // Automatically transitions to IDLE on the subsequent frame
        } else if (rawState === 'OPEN_PALM') {
            if (!this.isPalmRotating) {
                this.isPalmRotating = true;
                this.currentState = GestureStates.OPEN_PALM_START;
                if (this.onPalmStart) this.onPalmStart();
            } else {
                this.currentState = GestureStates.ROTATING;
                if (this.onRotating) this.onRotating();
            }
        } else if (this.isPalmRotating) {
            this.isPalmRotating = false;
            this.currentState = GestureStates.OPEN_PALM_RELEASE;
            if (this.onPalmRelease) this.onPalmRelease();
        } else if (rawState === 'FIST') {
            this.currentState = GestureStates.FIST;
        } else {
            this.currentState = GestureStates.IDLE;
        }

        // Fire onStateChange only when state actually transitions
        if (this.currentState !== prevState && this.onStateChange) {
            this.onStateChange(this.currentState, prevState);
        }

        return this.currentState;
    }

    reset() {
        this.currentState = GestureStates.IDLE;
        this.isPinching = false;
        this.isPalmRotating = false;
        this.pinchFrames = 0;
        this.unpinchFrames = 0;
    }
}
