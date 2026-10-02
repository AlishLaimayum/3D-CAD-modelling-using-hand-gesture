/**
 * CADCommands.js - Concrete Commands for 3D CAD Modeling
 */

import { Command } from './Command';

/**
 * Command to add a newly created CAD object (Line, Freehand Curve, Rectangle).
 */
export class CreateCADObjectCommand extends Command {
    /**
     * @param {Object} cadObject
     * @param {Object} storeApi - Store actions or setter functions
     */
    constructor(cadObject, storeApi) {
        super(`Create ${cadObject.type || 'Object'}`);
        this.cadObject = cadObject;
        this.storeApi = storeApi;
    }

    execute() {
        this.storeApi.internalAddObject(this.cadObject);
    }

    undo() {
        this.storeApi.internalRemoveObject(this.cadObject.id);
    }
}

/**
 * Command to delete a specific CAD object.
 */
export class DeleteCADObjectCommand extends Command {
    constructor(cadObject, storeApi) {
        super(`Delete ${cadObject.type || 'Object'}`);
        this.cadObject = cadObject;
        this.storeApi = storeApi;
    }

    execute() {
        this.storeApi.internalRemoveObject(this.cadObject.id);
    }

    undo() {
        this.storeApi.internalAddObject(this.cadObject);
    }
}

/**
 * Command to clear all CAD objects.
 */
export class ClearCADObjectsCommand extends Command {
    constructor(previousObjects, storeApi) {
        super('Clear All CAD Objects');
        this.previousObjects = [...previousObjects];
        this.storeApi = storeApi;
    }

    execute() {
        this.storeApi.internalSetObjects([]);
    }

    undo() {
        this.storeApi.internalSetObjects(this.previousObjects);
    }
}

/**
 * Command to update properties of a specific CAD object (e.g. Z-Scale elongation).
 */
export class UpdateCADObjectCommand extends Command {
    constructor(objectId, oldProps, newProps, storeApi) {
        super('Modify Object Transform');
        this.objectId = objectId;
        this.oldProps = oldProps;
        this.newProps = newProps;
        this.storeApi = storeApi;
    }

    execute() {
        this.storeApi.internalUpdateObject(this.objectId, this.newProps);
    }

    undo() {
        this.storeApi.internalUpdateObject(this.objectId, this.oldProps);
    }
}
