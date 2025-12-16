import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { copyTemplateDir } from "./copyTemplateDir";


export async function handleDevContainerDir(
    projectRoot: string,
    vars: Record<string, string>
) {

    const targetDevDir = path.join(projectRoot, ".devcontainer");
    const settings = vscode.workspace.getConfiguration("atmelGenerator");
    const devEnabled = settings.get<boolean>("enableDevContainer") ?? false;
    const custDevTplPath = settings.get<string>("devContainerTemplatePath");


    if (devEnabled) {
        if (custDevTplPath) {
            fs.rmSync(targetDevDir, { recursive: true, force: true });
            await copyTemplateDir(custDevTplPath, targetDevDir, vars);
        }
    } else {
        fs.rmSync(targetDevDir, { recursive: true, force: true });
    }
}