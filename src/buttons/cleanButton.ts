import * as vscode from "vscode";
import { Logger } from "../logger";
import { createCleanTask } from "../tasks/createCleanTask";
import { ConfigService } from "../services/ConfigService";

/**
 * Registers the status bar button and the command to execute the clean task.
 * This handles the UI interaction and delegates the task creation to the tasks module.
 * * @param context The extension context for subscriptions.
 */
export function registerCleanButton(context: vscode.ExtensionContext) {

    // ---------------------------------------------------------
    // 1. Create and configure the Status Bar Item
    // ---------------------------------------------------------
    const cleanButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    cleanButton.text = "$(trash) Clean";
    cleanButton.tooltip = "Clean .build folder (executes 'make clean')";
    cleanButton.command = "atmelGenerator.action.clean";

    // Helper to update visibility based on workspace state
    const updateVisibility = () => {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            // Check first folder for config.json with correct ID
            const root = folders[0].uri.fsPath;
            if (ConfigService.isAtmelProject(root)) {
                cleanButton.show();
                return;
            }
        }
        cleanButton.hide();
    };

    // Initial check and event listener
    updateVisibility();
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(updateVisibility)
    );

    // Watch for config.json changes (Created/Deleted/Changed)
    const watcher = vscode.workspace.createFileSystemWatcher("**/config.json");
    watcher.onDidCreate(updateVisibility);
    watcher.onDidDelete(updateVisibility);
    watcher.onDidChange(updateVisibility);
    context.subscriptions.push(watcher);

    context.subscriptions.push(cleanButton);

    // ---------------------------------------------------------
    // 2. Register the Command
    // ---------------------------------------------------------
    const cleanCommand = vscode.commands.registerCommand("atmelGenerator.action.clean", async () => {

        // Validation: We need at least one open folder
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("No workspace open. Cannot clean.");
            return;
        }

        // We assume single-root workspace or that the first folder is the target
        const projectRoot = vscode.workspace.workspaceFolders[0];

        Logger.info("Clean command triggered via Status Bar.");

        try {
            // Retrieve the task object from our separate module
            const task = createCleanTask(projectRoot);

            // Execute it
            await vscode.tasks.executeTask(task);
            Logger.info("Clean task execution started.");
        } catch (e: any) {
            const msg = `Failed to execute clean task: ${e.message}`;
            Logger.error(msg);
            vscode.window.showErrorMessage("Error starting clean task. Check Output for details.");
        }
    });

    context.subscriptions.push(cleanCommand);
}