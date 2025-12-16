import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Logger } from "../logger";
import { ProjectConfig } from "../models/ProjectConfig";

export class ProjectReconfigurator {

    /**
     * Updates the Makefile using values from the ProjectConfig.
     */
    public static async updateMakefile(
        extensionPath: string, 
        projectConfig: ProjectConfig
    ): Promise<void> {
        
        const templatePath = path.join(extensionPath, "templates", "base_project", "Makefile");
        const targetPath = path.join(projectConfig.rootPath, "Makefile");
        
        // Retrieve template variables from the config object
        const vars = projectConfig.getTemplateVars();

        try {
            let content = await fs.promises.readFile(templatePath, "utf8");

            Object.keys(vars).forEach(key => {
                const regex = new RegExp(`{{${key}}}`, "g");
                content = content.replace(regex, vars[key]);
            });

            await fs.promises.writeFile(targetPath, content, "utf8");
            Logger.info("ProjectReconfigurator: Makefile regenerated.");
        } catch (error: any) {
            Logger.error(`ProjectReconfigurator: Failed to update Makefile: ${error.message}`);
            throw error;
        }
    }

    /**
     * Updates the config.json file. Respects the 'protected' flag.
     */
    public static async updateConfigJson(projectConfig: ProjectConfig): Promise<void> {
        const configPath = path.join(projectConfig.rootPath, "config.json");

        try {
            let existingConfig: any = {};
            if (fs.existsSync(configPath)) {
                const raw = await fs.promises.readFile(configPath, "utf8");
                existingConfig = JSON.parse(raw);
            }

            if (existingConfig.protected === true) {
                Logger.warn("Project is protected. Skipping config update.");
                throw new Error("Project is protected.");
            }

            // Merge: Keep existing ID/Protected flags, overwrite the rest with new config
            const finalConfig = {
                ...existingConfig,
                ...projectConfig.toConfigJson()
            };

            await fs.promises.writeFile(configPath, JSON.stringify(finalConfig, null, 4), "utf8");
            Logger.info("ProjectReconfigurator: config.json updated.");

        } catch (error: any) {
            if (error.message === "Project is protected.") {throw error;}
            Logger.error(`Failed to update config.json: ${error.message}`);
            throw error;
        }
    }
}