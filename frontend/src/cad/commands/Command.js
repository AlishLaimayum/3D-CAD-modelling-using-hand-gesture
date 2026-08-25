/**
 * Command.js - Base Command Interface for CAD Operations
 */

export class Command {
    constructor(description = 'CAD Operation') {
        this.description = description;
        this.timestamp = Date.now();
    }

    /**
     * Executes the command.
     */
    execute() {
        throw new Error('Command.execute() must be implemented by subclass.');
    }

    /**
     * Reverses the command.
     */
    undo() {
        throw new Error('Command.undo() must be implemented by subclass.');
    }
}
