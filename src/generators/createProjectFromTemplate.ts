import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { copyTemplateDir } from "./copyTemplateDir";
import { handleDevContainerDir } from "./handleDevContainerDir";
import { IntelliSenseGenerator } from "./IntelliSenseGenerator";
import { ProjectReconfigurator } from "./ProjectReconfigurator"; 
import { Logger } from "../logger";
import { ProjectConfig } from "../models/ProjectConfig";

export async function createProjectFromTemplate(
    context: vscode.ExtensionContext,
    targetRoot: string,
    projectName: string,
    device: any,
    programmer: any
) {
    Logger.info("Starting project generation process...");

    const projectRoot = path.join(targetRoot, projectName);
    if (fs.existsSync(projectRoot)) {
        const msg = `Folder already exists: ${projectRoot}`;
        Logger.error(msg);
        vscode.window.showErrorMessage(msg);
        return;
    }

    try {
        fs.mkdirSync(projectRoot);
        Logger.info(`Created project directory: ${projectRoot}`);

        // 1. Read extension settings
        const config = vscode.workspace.getConfiguration("atmelGenerator");
        const devEnabled = config.get<boolean>("enableDevContainer") ?? false;
        
        // ... Load settings ...
        const defaultFreq = config.get<number>("defaultCPUFrequency") || 1000000;
        const portSetting = config.get<string>("port") || "usb";
        const bitClockSetting = config.get<string>("bitClock") || "5";

        // 2. Create ProjectConfig Instance
        const projectConfig = new ProjectConfig({
            project: projectName,
            rootPath: projectRoot,
            mcu: device.name.toLowerCase(), // GCC name
            partno: device.partno,          // AVRDUDE name (distinct attribute!)
            frequency: defaultFreq,
            programmer: programmer.prog,
            port: portSetting,
            bitClock: Number(bitClockSetting),
            ioDef: "__AVR_" + device.name + "__"
        });
        
        Logger.info(`Project Config prepared for MCU: ${projectConfig.mcu}`);

        // 3. Prepare Template Variables
        // We derive the replacement map directly from our config object.
        const templateVars = projectConfig.getTemplateVars();
        const templateDir = path.join(context.extensionPath, "templates", "base_project");
        
        Logger.info(`Copying templates from: ${templateDir}`);
        await copyTemplateDir(templateDir, projectRoot, templateVars);

        // 4. Handle DevContainer
        // Uses the same templateVars derived from the class
        Logger.info(`Handle devContainer ...`);
        await handleDevContainerDir(projectRoot, templateVars);

        // 5. Finalize config.json
        // Instead of a separate 'finalizeConfig' function, we use our unified Reconfigurator.
        // This ensures the file on disk matches exactly what is in our class instance.
        await ProjectReconfigurator.updateConfigJson(projectConfig);

        // 6. Generate IntelliSense Configuration
        Logger.info("Generating IntelliSense configuration...");
        await IntelliSenseGenerator.generate(projectConfig);

        // 7. Update Makefile
        // Although copyTemplateDir already replaced placeholders, this pass ensures
        // the Makefile is 100% in sync with the class logic (e.g. handling optional sections if any).
        await ProjectReconfigurator.updateMakefile(context.extensionPath, projectConfig);

        // 8. Open Project
        Logger.info("Project generation completed successfully.");
        vscode.window.showInformationMessage(`Project '${projectName}' created successfully.`);

        const openUri = vscode.Uri.file(projectRoot);
        const isDevelopment = context.extensionMode === vscode.ExtensionMode.Development;
        const forceNewWindow = !isDevelopment;
        await vscode.commands.executeCommand("vscode.openFolder", openUri, forceNewWindow);

    } catch (err: any) {
        Logger.error(`An error occurred during project generation: ${err.message}`);
        vscode.window.showErrorMessage(`Error generating project: ${err.message}`);
    }
}