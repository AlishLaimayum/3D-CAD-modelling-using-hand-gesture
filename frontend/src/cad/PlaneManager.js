import * as THREE from 'three';

class PlaneManager {

    constructor() {
        // Plane orientation
        this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');

        // Plane position
        this.position = new THREE.Vector3(0, 0, 0);

        // Lock state
        this.locked = false;
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
    }

    // ---------------------------------------------
    // VERTICAL ROTATION
    // ---------------------------------------------
    // Rotate around WORLD X axis
    // ---------------------------------------------

    rotateVertical(amount) {

        if (this.locked) return;

        this.rotation.x += amount;
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
    worldToLocal(worldPoint) {
        const pt = worldPoint.clone().sub(this.position);
        const invQuaternion = new THREE.Quaternion().setFromEuler(this.rotation).invert();
        pt.applyQuaternion(invQuaternion);
        return pt;
    }

    // Convert local plane coordinate to 3D world coordinate
    localToWorld(localPoint) {
        const pt = localPoint.clone();
        const quaternion = new THREE.Quaternion().setFromEuler(this.rotation);
        pt.applyQuaternion(quaternion);
        pt.add(this.position);
        return pt;
    }
}

export default PlaneManager;