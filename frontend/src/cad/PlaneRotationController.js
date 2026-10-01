class PlaneRotationController {

    constructor(planeManager) {

        this.planeManager = planeManager;

        this.mode = 'NONE';

        this.deadZone = 0.003;
        this.rotationSpeed = 4.5;

        // Roll sensitivity
        this.rollSpeed = 2.0;

        // Ignore tiny roll movements
        this.rollDeadZone = 0.015;

        // Smoothing factor
        // Smaller = smoother but slower
        // Larger = faster but more jitter
        this.rollSmoothing = 0.18;

        // Smoothed roll value
        this.smoothedRoll = 0;

        this.axisLocked = false;
    }

    // ---------------------------------------------
    // START PALM ROTATION
    // ---------------------------------------------

    start() {
        this.mode = 'NONE';
        this.axisLocked = false;
        this.smoothedRoll = 0;
    }

    // ---------------------------------------------
    // DEDICATED HORIZONTAL / VERTICAL ROTATIONS
    // ---------------------------------------------

    updateHorizontal(dx, camera) {
        if (Math.abs(dx) < this.deadZone) return;
        this.mode = 'HORIZONTAL';
        this.planeManager.rotateCameraRelativeHorizontal(
            dx * this.rotationSpeed,
            camera
        );
    }

    updateVertical(dy, camera) {
        if (Math.abs(dy) < this.deadZone) return;
        this.mode = 'VERTICAL';
        this.planeManager.rotateCameraRelativeVertical(
            dy * this.rotationSpeed,
            camera
        );
    }

    // Palm roll angle → clockwise/anticlockwise rotation around camera's forward axis.
    //
    // Sign derivation (do not change without re-reading this):
    //   Backend: landmarks are from cv2.flip(frame,1) — horizontal mirror.
    //            After flip, pinky(17) is at LEFT, index(5) is at RIGHT.
    //            palm_angle = atan2(pinky.y - index.y, pinky.x - index.x)
    //            Baseline (flat hand): atan2(0, negative) = π
    //   Palm CW (user's view): pinky goes UP (y↓), index goes DOWN (y↑)
    //            → dy = pinky.y - index.y becomes negative
    //            → angle decreases past ±π boundary
    //            → after wrap-normalisation: dangle > 0
    //   Three.js: setFromAxisAngle(cameraForward=(0,0,−1), +amount)
    //            Right-hand rule around −Z → clockwise from user's view.
    //   Therefore: amount = +dangle (no negation).
    //            -dangle would invert the direction — do not re-add the minus sign.
    updateRoll(dangle, camera) {

        // Ignore tracking noise
        if (Math.abs(dangle) < this.rollDeadZone) {
            return;
        }

        // Smooth the delta
        this.smoothedRoll =
            this.smoothedRoll +
            (dangle - this.smoothedRoll) * this.rollSmoothing;

        // Ignore remaining tiny movement
        if (Math.abs(this.smoothedRoll) < this.rollDeadZone) {
            return;
        }

        this.mode = 'ROLL';

        this.planeManager.rotateCameraRelativeRoll(
            this.smoothedRoll * this.rollSpeed,
            camera
        );
    }

    // ---------------------------------------------
    // GENERAL UPDATE ROTATION
    // ---------------------------------------------

    update(dx, dy, camera, gesture = null, dangle = 0) {
        if (gesture === 'PEACE') {
            this.updateHorizontal(dx, camera);
            return;
        }

        if (gesture === 'OPEN_PALM') {
            // Separate roll (palm twist) from vertical tilt (palm up/down) so they don't fight.
            // If roll dominates, skip vertical; if vertical dominates, skip roll.
            const rollDominant = Math.abs(dangle) > Math.abs(dy) * 1.5;
            if (rollDominant) {
                this.updateRoll(dangle, camera);
            } else {
                this.updateVertical(dy, camera);
            }
            return;
        }

        // Fallback dominant axis selection
        if (this.mode === 'NONE') {
            if (
                Math.abs(dx) < this.deadZone &&
                Math.abs(dy) < this.deadZone
            ) {
                return;
            }

            this.mode = Math.abs(dx) > Math.abs(dy) ? 'HORIZONTAL' : 'VERTICAL';
            this.axisLocked = true;
        }

        if (this.mode === 'HORIZONTAL') {
            this.updateHorizontal(dx, camera);
            return;
        }

        if (this.mode === 'VERTICAL') {
            this.updateVertical(dy, camera);
            return;
        }
    }

    // ---------------------------------------------
    // STOP ROTATION
    // ---------------------------------------------

    stop() {
        this.mode = 'NONE';
        this.axisLocked = false;
        this.smoothedRoll = 0;
    }

    // ---------------------------------------------
    // GET CURRENT MODE
    // ---------------------------------------------

    getMode() {

        return this.mode;
    }
}

export default PlaneRotationController;