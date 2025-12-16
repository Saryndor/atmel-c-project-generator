import * as vscode from "vscode";

export async function askProjectName(defaultName: string): Promise<string | undefined> {
    return await vscode.window.showInputBox({
        title: "Project Name",
        value: defaultName,
        prompt: "Enter the name for the new project."
    });
}
