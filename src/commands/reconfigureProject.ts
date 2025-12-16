import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { IntelliSenseGenerator } from "../generators/IntelliSenseGenerator";
import { ProjectReconfigurator } from "../generators/ProjectReconfigurator";
import { ConfigService } from "../services/ConfigService";
import { Logger } from "../logger";
import { ProjectConfig } from "../models/ProjectConfig";

export async function reconfigureProject(context: vscode.ExtensionContext) {
    Logger.info("Command: Reconfigure Project triggered.");

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace open. Cannot reconfigure.");
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const configPath = path.join(rootPath, "config.json");

    if (!fs.existsSync(configPath)) {
        vscode.window.showErrorMessage("No 'config.json' found. Is this an Atmel C Generator project?");
        return;
    }

    try {
        const raw = fs.readFileSync(configPath, "utf8");
        // Check protection before doing expensive operations
        if (!raw) {
            const msg = "No project configuration 'config.json' found. Reconfiguration aborted.";
            Logger.warn(msg);
            vscode.window.showWarningMessage(msg);
            return;
        }

        const json = JSON.parse(raw);
        // Check id before doing expensive operations
        if (json.id !== "atmel-project-config" || !json.id ) {
            const msg = "No valid prroject configuration found. Missing or wrong 'id'. Reconfiguration aborted.";
            Logger.warn(msg);
            vscode.window.showWarningMessage(msg);
            return;
        }

        // Check protection before doing expensive operations
        if (json.protected) {
            const msg = "Project configuration is PROTECTED. Reconfiguration aborted.";
            Logger.warn(msg);
            vscode.window.showWarningMessage(msg);
            return;
        }

        const defaults = ConfigService.getGlobalDefaults();

        // 1. Read Raw Data (No Assumptions)
        // We strictly read what is in the file.
        const mcu = json.mcu;       // GCC ID
        const partno = json.partno; // AVRDUDE partno
        const ioDef = json.io_def;  // Header Define
        const prog = json.programmer; // AVRDUDE programmer
        
        // 2. Validate Essential Data
        // If any hardware definition is missing, we must NOT guess.
        // The user must ensure config.json is valid.
        if (!mcu || !partno || !ioDef || !prog) {
            const msg = "Invalid config.json: 'mcu', 'programmer', 'partno' or 'io_def' is missing. Please verify config.json.";
            Logger.error(msg);
            vscode.window.showErrorMessage(msg);
            return;
        }

        
        // 3. Instantiate ProjectConfig
        const projectConfig = new ProjectConfig({
            project: json.project,
            rootPath: rootPath,
            mcu: mcu,
            partno: partno,
            frequency: Number(json.cpu_freq),
            programmer: json.programmer,
            port: json.port,
            bitClock: Number(json.bitClock),
            ioDef: ioDef
        });

        Logger.info(`Reconfiguring for: ${projectConfig.mcu} (Part: ${projectConfig.partno})`);

        // 4. Update Config JSON (Persist valid state)
        await ProjectReconfigurator.updateConfigJson(projectConfig);

        // 5. Generate IntelliSense
        await IntelliSenseGenerator.generate(projectConfig);

        // 6. Update Makefile
        await ProjectReconfigurator.updateMakefile(context.extensionPath, projectConfig);

        vscode.window.showInformationMessage(`Project reconfigured successfully (${projectConfig.mcu}).`);

    } catch (error: any) {
        if (error.message !== "Project is protected.") {
            Logger.error(`Reconfigure failed: ${error.message}`);
            vscode.window.showErrorMessage(`Reconfiguration failed: ${error.message}`);
        }
    }
}