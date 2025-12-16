import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export async function finalizeConfig(
    projectRoot: string,
    vars: Record<string, string>
) {
    try {
        const configPath = path.join(projectRoot, "config.json");

        if (!fs.existsSync(configPath)) {
            return;
        }

        let content = fs.readFileSync(configPath, "utf8");

        // Replace variables
        for (const [key, value] of Object.entries(vars)) {
            const pattern = new RegExp(`{{${key}}}`, "g");
            content = content.replace(pattern, value);
        }

        // Parse JSON to ensure validity
        const jsonObj = JSON.parse(content);

        // Fix numeric types
        if (jsonObj.cpu_freq) {
            jsonObj.cpu_freq = Number(jsonObj.cpu_freq);
        }

        // Save pretty formatted JSON
        fs.writeFileSync(configPath, JSON.stringify(jsonObj, null, 4), "utf8");

    } catch (e: any) {
        vscode.window.showErrorMessage("Failed to finalize config.json: " + e.message);
    }
}
