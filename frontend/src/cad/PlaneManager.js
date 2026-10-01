import * as THREE from 'three';

class PlaneManager {

    constructor() {
        // Plane orientation
        this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');

        // Plane position
        this.position = new THREE.Vector3(0, 0, 0);

        // Lock state
        this.locked = false;

        // Cached quaternions for high-frequency worldToLocal and localToWorld conversions
        this.quaternion = new THREE.Quaternion().setFromEuler(this.rotation);
        this.invQuaternion = this.quaternion.clone().invert();
    }

    _updateQuaternions() {
        this.quaternion.setFromEuler(this.rotation);
        this.invQuaternion.copy(this.quaternion).invert();
    }

    // ---------------------------------------------
    // HORIZONTAL ROTATION
    // ---------------------------------------------
    // Rotate around WORLD Y axis
    // This changes the plane from front-facing
    // toward side-facing.
    // ---------------------------------------------

    rotateHorizontal(amount) {

        if (this.locked) return;

        this.rotation.y += amount;
        this._updateQuaternions();
    }

    // ---------------------------------------------
    // VERTICAL ROTATION
    // ---------------------------------------------
    // Rotate around WORLD X axis
    // ---------------------------------------------

    rotateVertical(amount) {

        if (this.locked) return;

        this.rotation.x += amount;
        this._updateQuaternions();
    }

    // ---------------------------------------------
    // CAMERA RELATIVE ROTATIONS
    // ---------------------------------------------

    rotateCameraRelativeHorizontal(amount, camera) {
        if (this.locked) return;
        const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

        const q = new THREE.Quaternion().setFromEuler(this.rotation);
        const qInc = new THREE.Quaternion().setFromAxisAngle(cameraUp, amount);
        q.premultiply(qInc);
        this.rotation.setFromQuaternion(q);
        this._updateQuaternions();
    }

    rotateCameraRelativeVertical(amount, camera) {
        if (this.locked) return;
        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();

        const q = new THREE.Quaternion().setFromEuler(this.rotation);
        const qInc = new THREE.Quaternion().setFromAxisAngle(cameraRight, amount);
        q.premultiply(qInc);
        this.rotation.setFromQuaternion(q);
        this._updateQuaternions();
    }

    rotateCameraRelativeRoll(amount, camera) {
        if (this.locked) return;
        // Rotate around camera's forward axis (line of sight) — matches palm clockwise/anticlockwise roll
        const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

        const q = new THREE.Quaternion().setFromEuler(this.rotation);
        const qInc = new THREE.Quaternion().setFromAxisAngle(cameraForward, amount);
        q.premultiply(qInc);
        this.rotation.setFromQuaternion(q);
        this._updateQuaternions();
    }

    // ---------------------------------------------
    // LOCK
    // ---------------------------------------------

    lock() {
        this.locked = true;
    }

    // ---------------------------------------------
    // UNLOCK
    // ---------------------------------------------

    unlock() {
        this.locked = false;
    }

    // ---------------------------------------------
    // SET LOCK
    // ---------------------------------------------

    setLocked(value) {
        this.locked = value;
    }

    // ---------------------------------------------
    // GET ROTATION
    // ---------------------------------------------

    getRotation() {

        return [
            this.rotation.x,
            this.rotation.y,
            this.rotation.z
        ];
    }

    // ---------------------------------------------
    // SET ROTATION
    // ---------------------------------------------

    setRotation(x, y, z) {

        this.rotation.set(x, y, z);
        this._updateQuaternions();
    }

    setPosition(x, y, z) {
        this.position.set(x, y, z);
    }

    getPosition() {
        return [this.position.x, this.position.y, this.position.z];
    }

    // ---------------------------------------------
    // GET PLANE NORMAL
    // ---------------------------------------------

    getNormal() {

        return new THREE.Vector3(0, 1, 0)
            .applyEuler(this.rotation)
            .normalize();
    }

    // ---------------------------------------------
    // GET THREE.JS PLANE
    // ---------------------------------------------

    getThreePlane() {

        const normal = this.getNormal();

        const plane = new THREE.Plane();

        plane.setFromNormalAndCoplanarPoint(
            normal,
            this.position
        );

        return plane;
    }

    // Convert 3D world coordinate to local plane coordinate
    worldToLocal(worldPoint, target = new THREE.Vector3()) {
        if (Array.isArray(worldPoint)) {
            target.set(worldPoint[0], worldPoint[1], worldPoint[2]);
        } else if (worldPoint instanceof THREE.Vector3) {
            target.copy(worldPoint);
        }
        target.sub(this.position);
        target.applyQuaternion(this.invQuaternion);
        if (Math.abs(target.y) < 1e-6) target.y = 0;
        return target;
    }

    // Convert local plane coordinate to 3D world coordinate
    localToWorld(localPoint, target = new THREE.Vector3()) {
        if (Array.isArray(localPoint)) {
            target.set(localPoint[0], localPoint[1], localPoint[2]);
        } else if (localPoint instanceof THREE.Vector3) {
            target.copy(localPoint);
        }
        target.applyQuaternion(this.quaternion);
        target.add(this.position);
        return target;
    }
}

export default PlaneManager;