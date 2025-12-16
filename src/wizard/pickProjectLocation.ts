// import * as vscode from "vscode";
// import * as path from "path";

// export async function pickProjectLocation(
//     defaultName: string
// ): Promise<{ folder: string; projectName: string } | undefined> {

//     const uri = await vscode.window.showSaveDialog({
//         title: "Select Project Folder ...",
//         saveLabel: "Generate Project Folder",
//         defaultUri: vscode.Uri.file(defaultName)
//     });

//     if (!uri) {
//         return undefined;
//     }

//     const projectName = path.basename(uri.fsPath);
//     const folder = path.dirname(uri.fsPath);

//     return { folder, projectName };
// }

import * as vscode from "vscode";
import * as path from "path";

export async function pickProjectLocation(
    defaultName: string
): Promise<{ folder: string; projectName: string } | undefined> {

    // Read extension settings
    const config = vscode.workspace.getConfiguration("atmelGenerator");
    const defaultProjectPath = config.get<string>("defaultProjectPath") || "";

    // Determine default URI
    let defaultUri: vscode.Uri | undefined = undefined;

    if (defaultProjectPath.trim() !== "") {
        // If user defined a default folder → use it
        defaultUri = vscode.Uri.file(
            path.join(defaultProjectPath, defaultName)
        );
    } else {
        // Otherwise fallback:
        // VS Code handles the system default save location
        defaultUri = vscode.Uri.file(defaultName);
    }

    const uri = await vscode.window.showSaveDialog({
        title: "Create Atmel Project",
        saveLabel: "Create Project",
        defaultUri: defaultUri
    });

    if (!uri) {
        return undefined;
    }

    const projectName = path.basename(uri.fsPath);
    const folder = path.dirname(uri.fsPath);

    return { folder, projectName };
}
