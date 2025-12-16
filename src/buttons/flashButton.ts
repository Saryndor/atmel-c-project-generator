import * as vscode from "vscode";
import { Logger } from "../logger";
import { createFlashTask } from "../tasks/createFlashTask"; // Import the task logic

/**
 * Registers the status bar button and the command to execute the flash task.
 * This handles the UI interaction and delegates the task creation to the tasks module.
 * * @param context The extension context for subscriptions.
 */
export function registerFlashButton(context: vscode.ExtensionContext) {

    // ---------------------------------------------------------
    // 1. Create and configure the Status Bar Item
    // ---------------------------------------------------------
    const flashButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    flashButton.text = "$(zap) Flash";
    flashButton.tooltip = "Flash Firmware (executes 'make flash')";
    flashButton.command = "atmelGenerator.action.flash";

    // Helper to update visibility based on workspace state
    const updateVisibility = () => {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            flashButton.show();
        } else {
            flashButton.hide();
        }
    };

    // Initial check and event listener
    updateVisibility();
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(updateVisibility)
    );
    context.subscriptions.push(flashButton);

    // ---------------------------------------------------------
    // 2. Register the Command
    // ---------------------------------------------------------
    const flashCommand = vscode.commands.registerCommand("atmelGenerator.action.flash", async () => {
        
        // Validation: We need at least one open folder
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("No workspace open. Cannot flash.");
            return;
        }

        // We assume single-root workspace or that the first folder is the target
        const projectRoot = vscode.workspace.workspaceFolders[0];

        Logger.info("Flash command triggered via Status Bar.");

        try {
            // Retrieve the task object from our separate module
            const task = createFlashTask(projectRoot);

            // Execute it
            await vscode.tasks.executeTask(task);
            Logger.info("Flash task execution started.");
        } catch (e: any) {
            const msg = `Failed to execute flash task: ${e.message}`;
            Logger.error(msg);
            vscode.window.showErrorMessage("Error starting flash task. Check Output for details.");
        }
    });

    context.subscriptions.push(flashCommand);
}