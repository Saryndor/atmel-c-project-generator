import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { FuseHardwareConfig } from "./AvrDudeService";
import { Logger } from "../logger";

export class ConfigService {

    /**
     * Tries to resolve the hardware configuration in the following order:
     * 1. 'config.json' in the workspace root.
     * 2. VS Code Extension Settings (Global/Workspace).
     */
    public static async resolveHardwareConfig(extensionPath: string): Promise<Partial<FuseHardwareConfig> | undefined> {
        
        // 1. Try Project Config (config.json)
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const configPath = path.join(root, "config.json");
            
            if (fs.existsSync(configPath)) {
                try {
                    const content = await fs.promises.readFile(configPath, "utf8");
                    const json = JSON.parse(content);
                    
                    if (json.partno || json.mcu) {
                         Logger.info("ConfigService: Found valid config.json in project.");
                         return {
                             partno: json.partno || json.mcu,
                             programmer: json.programmer,
                             port: json.port,
                             bitClock: json.bitClock || json.bitclock, // handle both casings just in case
                             cwd: root
                         };
                    }
                } catch (e) {
                    Logger.warn("ConfigService: config.json exists but could not be parsed.");
                }
            }
        }

        // 2. Try VS Code Settings (Fallback)
        const settings = vscode.workspace.getConfiguration("atmelGenerator");
        const globalProg = settings.get<string>("programmer");
        const globalPort = settings.get<string>("port");
        // Ensure we read the setting key exactly as defined in package.json ("atmelGenerator.bitClock")
        const globalBitClock = settings.get<number>("bitClock"); 

        if (globalProg) {
            Logger.info(`ConfigService: Using global settings.`);
            return {
                programmer: globalProg,
                port: globalPort || "usb",
                bitClock: globalBitClock, // Pass number or undefined
                cwd: "." 
            };
        }

        return undefined;
    }

    /**
     * Retrieves the global defaults from VS Code settings directly.
     */
    public static getGlobalDefaults(): { programmer: string | undefined, port: string, bitClock: string } {
        const settings = vscode.workspace.getConfiguration("atmelGenerator");
        const bc = settings.get<number>("bitClock");
        
        return {
            programmer: settings.get<string>("programmer"), 
            port: settings.get<string>("port") || "usb",
            bitClock: bc ? String(bc) : "5" // Default to 5 if setting is missing
        };
    }

    /**
     * Checks if the given workspace folder contains a valid config.json
     * with the correct ID.
     */
    public static isAtmelProject(folderPath: string): boolean {
        try {
            const configPath = path.join(folderPath, "config.json");
            if (!fs.existsSync(configPath)) {
                return false;
            }
            const content = fs.readFileSync(configPath, "utf8");
            const json = JSON.parse(content);
            return json.id === "atmel-project-config";
        } catch (error) {
            return false;
        }
    }
}