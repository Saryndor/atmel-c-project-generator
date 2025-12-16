import * as vscode from "vscode";
import { Logger } from "../logger";
import { createBuildTask } from "../tasks/createBuildTask"; // Import the task logic

/**
 * Registers the status bar button and the command to execute the build task.
 * This handles the UI interaction and delegates the task creation to the tasks module.
 * * @param context The extension context for subscriptions.
 */
export function registerBuildButton(context: vscode.ExtensionContext) {

    // ---------------------------------------------------------
    // 1. Create and configure the Status Bar Item
    // ---------------------------------------------------------
    const buildButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
    buildButton.text = "$(wrench) Build";
    buildButton.tooltip = "Build Firmware (executes 'make all')";
    buildButton.command = "atmelGenerator.action.build";

    // Helper to update visibility based on workspace state
    const updateVisibility = () => {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            buildButton.show();
        } else {
            buildButton.hide();
        }
    };

    // Initial check and event listener
    updateVisibility();
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(updateVisibility)
    );
    context.subscriptions.push(buildButton);

    // ---------------------------------------------------------
    // 2. Register the Command
    // ---------------------------------------------------------
    const buildCommand = vscode.commands.registerCommand("atmelGenerator.action.build", async () => {
        
        // Validation: We need at least one open folder
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("No workspace open. Cannot build.");
            return;
        }

        // We assume single-root workspace or that the first folder is the target
        const projectRoot = vscode.workspace.workspaceFolders[0];

        Logger.info("Build command triggered via Status Bar.");

        try {
            // Retrieve the task object from our separate module
            const task = createBuildTask(projectRoot);

            // Execute it
            await vscode.tasks.executeTask(task);
            Logger.info("Build task execution started.");
        } catch (e: any) {
            const msg = `Failed to execute build task: ${e.message}`;
            Logger.error(msg);
            vscode.window.showErrorMessage("Error starting build task. Check Output for details.");
        }
    });

    context.subscriptions.push(buildCommand);
}