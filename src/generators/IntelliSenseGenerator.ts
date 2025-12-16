import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Logger } from "../logger";
import { ProjectConfig } from "../models/ProjectConfig";

export class IntelliSenseGenerator {

    /**
     * Generates c_cpp_properties.json using the ProjectConfig object.
     * Reads the compiler path directly from extension settings internally.
     * * @param projectConfig The project configuration instance.
     */
    // public static async generate(projectConfig: ProjectConfig): Promise<string[]> {
    public static async generate(projectConfig: ProjectConfig) {
        Logger.info(`IntelliSenseGenerator: Reconfiguring for Project=${projectConfig.project}...`);

        const config = vscode.workspace.getConfiguration("atmelGenerator");
        const compilerPath = config.get<string>("defaultCompilerPath") || "avr-gcc";

        // 1. Probe System Includes
        // const systemIncludes = await this.detectSystemIncludes(compilerPath, projectConfig.mcu);

        // 2. Define Project Includes
        const projectIncludes = [
            "${workspaceFolder}/include",
            "${workspaceFolder}/lib/**"
        ];

        // 3. Combine & Deduplicate
        const uniqueIncludes = Array.from(new Set([...projectIncludes]));
        // const uniqueIncludes = Array.from(new Set([...projectIncludes, ...systemIncludes]));

        const cCppProperties = {
            configurations: [
                {
                    name: projectConfig.project,
                    compilerPath: compilerPath,
                    compilerArgs: [
                        `-mmcu=${projectConfig.mcu}`
                    ],
                    cStandard: "c11",
                    cppStandard: "c++17",
                    intelliSenseMode: process.platform === "win32" ? "windows-gcc-x64" : "linux-gcc-x64",
                    includePath: uniqueIncludes,
                    defines: projectConfig.getPreprocessorDefines()
                }
            ],
            version: 4
        };

        // 4. Write File
        if (!fs.existsSync(projectConfig.vscodeDir)) {
            fs.mkdirSync(projectConfig.vscodeDir, { recursive: true });
        }
        
        const filePath = path.join(projectConfig.vscodeDir, "c_cpp_properties.json");
        await fs.promises.writeFile(filePath, JSON.stringify(cCppProperties, null, 4), "utf8");
        
        Logger.info(`IntelliSenseGenerator: Config written to ${filePath}`);
        
        // return systemIncludes;
    }

    // private static detectSystemIncludes(compilerPath: string, mcu: string): Promise<string[]> {
    //     return new Promise((resolve) => {
    //         const cmd = `echo "" | "${compilerPath}" -mmcu=${mcu} -E -Wp,-v -x c -`;
            
    //         cp.exec(cmd, (err, stdout, stderr) => {
    //             const output = (stdout || "") + "\n" + (stderr || "");
    //             const includes: string[] = [];

    //             if (err) {
    //                 Logger.warn(`IntelliSenseGenerator: Probe warning: ${err.message}`);
    //             }

    //             const lines = output.split('\n');
    //             let capturing = false;

    //             for (const line of lines) {
    //                 const trimmed = line.trim();
    //                 if (trimmed === "#include <...> search starts here:") {
    //                     capturing = true;
    //                     continue;
    //                 }
    //                 if (trimmed === "End of search list.") {
    //                     capturing = false;
    //                     break;
    //                 }

    //                 if (capturing && trimmed.length > 0) {
    //                     const validPath = path.resolve(path.normalize(trimmed));
                        
    //                     if (fs.existsSync(validPath)) {
    //                         includes.push(validPath);
    //                         const avrSubDir = path.join(validPath, "avr");
    //                         if (fs.existsSync(avrSubDir)) {
    //                             includes.push(avrSubDir);
    //                         }
    //                     }
    //                 }
    //             }

    //             if (includes.length === 0) {
    //                 const defaults = ["/usr/lib/avr/include", "/usr/lib/avr/include/avr", "/usr/include"];
    //                 defaults.forEach(p => { if (fs.existsSync(p)) {includes.push(p);} });
    //             }
                
    //             resolve(includes);
    //         });
    //     });
    // }
}