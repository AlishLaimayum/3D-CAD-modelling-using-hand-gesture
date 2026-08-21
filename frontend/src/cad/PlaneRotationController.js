class PlaneRotationController {

    constructor(planeManager) {

        this.planeManager = planeManager;

        // Current rotation mode
        this.mode = 'NONE';

        // Ignore tiny movements
        this.deadZone = 0.003;

        // Rotation sensitivity
        this.rotationSpeed = 4.5;

        // Prevent accidental axis switching
        this.axisLocked = false;
    }

    // ---------------------------------------------
    // START PALM ROTATION
    // ---------------------------------------------

    start() {

        this.mode = 'NONE';
        this.axisLocked = false;
    }

    // ---------------------------------------------
    // UPDATE ROTATION
    // ---------------------------------------------

    update(dx, dy, camera) {

        // -----------------------------------------
        // Determine rotation axis ONLY ONCE
        // -----------------------------------------

        if (this.mode === 'NONE') {

            // Ignore tiny movement
            if (
                Math.abs(dx) < this.deadZone &&
                Math.abs(dy) < this.deadZone
            ) {
                return;
            }

            // Determine dominant direction
            if (Math.abs(dx) > Math.abs(dy)) {

                this.mode = 'HORIZONTAL';

            } else {

                this.mode = 'VERTICAL';
            }

            this.axisLocked = true;
        }

        // -----------------------------------------
        // HORIZONTAL
        // -----------------------------------------

        if (this.mode === 'HORIZONTAL') {

            // Ignore vertical movement completely
            this.planeManager.rotateCameraRelativeHorizontal(
                dx * this.rotationSpeed,
                camera
            );

            return;
        }

        // -----------------------------------------
        // VERTICAL
        // -----------------------------------------

        if (this.mode === 'VERTICAL') {

            // Ignore horizontal movement completely
            this.planeManager.rotateCameraRelativeVertical(
                dy * this.rotationSpeed,
                camera
            );

            return;
        }
    }

    // ---------------------------------------------
    // STOP ROTATION
    // ---------------------------------------------

    stop() {

        this.mode = 'NONE';
        this.axisLocked = false;
    }

    // ---------------------------------------------
    // GET CURRENT MODE
    // ---------------------------------------------

    getMode() {

        return this.mode;
    }
}

export default PlaneRotationController;