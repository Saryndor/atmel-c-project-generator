import * as vscode from "vscode";

/**
 * Creates a programmatic task for flashing the firmware.
 * This defines WHAT the task does (run 'make flash'), but not HOW it is triggered.
 * * @param projectRoot The workspace folder where the Makefile is located.
 * @returns A fully configured vscode.Task object ready for execution.
 */
export function createFlashTask(projectRoot: vscode.WorkspaceFolder): vscode.Task {
    
    // 1. Define the command execution
    // We execute "make flash" in the root of the provided workspace folder.
    const execution = new vscode.ShellExecution("make flash", {
        cwd: projectRoot.uri.fsPath
    });

    // 2. Create the Task object
    // "atmel-task" is the internal definition type (can be anything unique)
    const task = new vscode.Task(
        { type: 'atmel-task' },
        projectRoot,                // Scope
        "Flash Firmware",           // Name (visible in terminal title)
        "Atmel Generator",          // Source (visible in terminal title)
        execution
    );

    // 3. Configure Presentation Options
    // These settings control how the terminal window behaves during execution.
    task.group = vscode.TaskGroup.Build;
    task.presentationOptions = {
        echo: true,                 // Show the command in the terminal
        reveal: vscode.TaskRevealKind.Always, // Always bring the terminal to front
        focus: false,               // Do not take keyboard focus away from the editor
        panel: vscode.TaskPanelKind.Shared,   // Reuse the terminal instance to keep things clean
        showReuseMessage: false,    // Don't show "Terminal will be reused..."
        clear: true                 // Clear previous output before running
    };

    return task;
}