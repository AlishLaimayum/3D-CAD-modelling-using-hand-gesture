/**
 * CommandManager.js - Undo / Redo Command History Manager
 */

export class CommandManager {
    constructor(maxHistory = 100) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = maxHistory;
        this.onStackChange = null;
    }

    /**
     * Execute a new command and record it on the undo stack.
     * @param {Command} command
     */
    execute(command) {
        if (!command) return;

        command.execute();
        this.undoStack.push(command);

        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        // Clear redo stack on new action
        this.redoStack = [];

        this._notify();
    }

    /**
     * Undo the most recent command.
     */
    undo() {
        if (this.undoStack.length === 0) return false;

        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);

        this._notify();
        return true;
    }

    /**
     * Redo the previously undone command.
     */
    redo() {
        if (this.redoStack.length === 0) return false;

        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);

        this._notify();
        return true;
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this._notify();
    }

    _notify() {
        if (this.onStackChange) {
            this.onStackChange({
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                undoCount: this.undoStack.length,
                redoCount: this.redoStack.length
            });
        }
    }
}

// Global shared command manager instance
export const cadCommandManager = new CommandManager();
