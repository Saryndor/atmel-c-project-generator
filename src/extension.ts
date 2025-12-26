import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { pickDevice } from "./wizard/pickDevice";
import { pickProgrammer } from "./wizard/pickProgrammer";
import { pickProjectLocation } from "./wizard/pickProjectLocation";
import { createProjectFromTemplate } from "./generators/createProjectFromTemplate";
import { Logger } from "./logger";
import { registerFlashButton } from "./buttons/flashButton";
import { registerBuildButton } from "./buttons/buildButton";
import { registerCleanButton } from "./buttons/cleanButton";
import { FuseCalculatorPanel } from "./panels/FuseCalculatorPanel";
import { ConfigService } from "./services/ConfigService";
import { FuseHardwareConfig } from "./services/AvrDudeService";
import { reconfigureProject } from "./commands/reconfigureProject";
import { TimerCalculatorPanel } from "./panels/timerCalculatorPanel";


export function activate(context: vscode.ExtensionContext) {

    // Initialize the Logger once when the extension activates
    Logger.initialize("Atmel C Generator");
    Logger.info("Extension activated.");

    context.subscriptions.push(
        vscode.tasks.registerTaskProvider('atmel-task', {
            provideTasks: () => [],
            resolveTask: (_task) => undefined
        })
    );


    registerFlashButton(context);
    registerBuildButton(context);
    registerCleanButton(context);

    const checkContext = () => {
        let isActive = false;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
            isActive = ConfigService.isAtmelProject(root);
        }
        vscode.commands.executeCommand('setContext', 'atmelProjectActive', isActive);
    };
    
    // Initial Check
    checkContext();
    
    // Watcher für Context
    const configWatcher = vscode.workspace.createFileSystemWatcher("**/config.json");
    configWatcher.onDidCreate(checkContext);
    configWatcher.onDidDelete(checkContext);
    configWatcher.onDidChange(checkContext);
    context.subscriptions.push(configWatcher);

    const disposable = vscode.commands.registerCommand(
        "atmelGenerator.createProject",
        async () => {

            // Optional: Show the output window when the wizard starts
            Logger.show();
            Logger.info("Starting new project wizard...");

            // -------------------------------
            // Step 1: Select device
            // -------------------------------
            const selectedDevice = await pickDevice(context);
            if (!selectedDevice) {
                Logger.info("Device selection cancelled by user.");
                vscode.window.showInformationMessage("Device selection cancelled.");
                return;
            }
            Logger.info(`Device selected: ${selectedDevice.label}`);

            // -------------------------------
            // Step 2: Select programmer
            // -------------------------------
            const selectedProgrammer = await pickProgrammer(context, selectedDevice.device);
            if (!selectedProgrammer) {
                Logger.info("Programmer selection cancelled by user.");
                vscode.window.showInformationMessage("Programmer selection cancelled.");
                return;
            }
            Logger.info(`Programmer selected: ${selectedProgrammer.label}`);

            // -------------------------------
            // Step 3: Enter project name
            // -------------------------------
            const projectInfo = await pickProjectLocation(
                // `${selectedDevice.device.name}_Project`
                selectedDevice.device.name + '_Project'
            );
            if (!projectInfo) {
                Logger.info("Project location selection cancelled by user.");
                vscode.window.showInformationMessage("Project creation cancelled.");
                return;
            }

            const { folder, projectName } = projectInfo;
            Logger.info(`Project destination: ${folder}, Name: ${projectName}`);

            // -------------------------------
            // Step 4: Create project
            // -------------------------------
            await createProjectFromTemplate(
                context,
                folder,
                projectName,
                selectedDevice.device,
                selectedProgrammer.programmer
            );
        }
    );

    context.subscriptions.push(disposable);

    const fuseCalcCommand = vscode.commands.registerCommand("atmelGenerator.openFuseCalculator", async () => {

        // 1. Resolve Configuration via Hierarchy (Config.json -> Settings)
        const resolvedConfig = await ConfigService.resolveHardwareConfig(context.extensionPath);

        let finalPartNo = resolvedConfig?.partno;
        let finalProgrammer = resolvedConfig?.programmer;
        let finalPort = resolvedConfig?.port;
        let finalBitClock = resolvedConfig?.bitClock;
        const finalCwd = resolvedConfig?.cwd || ".";

        // 2. MCU Missing? -> Ask User (Wizard)
        if (!finalPartNo) {
            const selection = await pickDevice(context);
            if (!selection) {
                return; // User cancelled
            }
            finalPartNo = selection.device.partno;
        }

        // 3. Load Device Data (needed for Programmer Wizard if fallback is required)
        const dbPath = path.join(context.extensionPath, "data", "atmel_devices.json");
        const dbRaw = await fs.promises.readFile(dbPath, "utf8");
        const db = JSON.parse(dbRaw);

        // Find device in DB
        const deviceData = db.devices.find((d: any) => d.partno === finalPartNo || d.name.toLowerCase() === finalPartNo?.toLowerCase());

        if (!deviceData) {
            vscode.window.showErrorMessage(`Device data for '${finalPartNo}' not found in database.`);
            return;
        }

        // 4. Programmer Missing? -> Check Global Defaults again -> Ask User
        if (!finalProgrammer) {
            // Check Global Defaults explicitly (if not resolved by ConfigService already)
            const defaults = ConfigService.getGlobalDefaults();

            if (defaults.programmer) {
                finalProgrammer = defaults.programmer;
                finalPort = defaults.port;
            } else {
                // No config.json AND no Global Settings -> Ask User manually
                Logger.info("No programmer configured anywhere. Asking user...");

                const progSelection = await pickProgrammer(context, deviceData);
                if (!progSelection) {
                    return; // User cancelled
                }
                finalProgrammer = progSelection.programmer.prog;

                // Ask for Port 
                const portInput = await vscode.window.showInputBox({
                    prompt: "Enter Port (e.g. usb, COM3, /dev/ttyUSB0, /dev/ttyACM0)",
                    value: "",
                    placeHolder: ""
                });

                if (portInput === undefined) {
                    return; // User cancelled
                }
                finalPort = portInput;
            }
        }

        // 5. Construct Final Config Object
        const hardwareConfig: FuseHardwareConfig = {
            partno: finalPartNo!, // Assert not null because we handled it in step 2
            programmer: finalProgrammer!,
            port: finalPort || "usb",
            bitClock: finalBitClock,
            cwd: finalCwd
        };

        // 6. Launch Panel
        FuseCalculatorPanel.createOrShow(context, deviceData, hardwareConfig);
    });

    context.subscriptions.push(fuseCalcCommand);

    const reconfigureCmd = vscode.commands.registerCommand("atmelGenerator.reconfigureProject", async () => {
        await reconfigureProject(context);
    });

    context.subscriptions.push(reconfigureCmd);

    const timerCalcCommand = vscode.commands.registerCommand("atmelGenerator.openTimerCalculator", () => {
        
        let projectFreq = 1000000; // Fallback Default: 1 MHz

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            try {
                const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const configPath = path.join(root, "config.json");
                
                if (fs.existsSync(configPath)) {
                    const content = fs.readFileSync(configPath, "utf8");
                    const json = JSON.parse(content);
                    if (json.cpu_freq) {
                        projectFreq = Number(json.cpu_freq);
                    }
                }
            } catch (e) {
                Logger.warn("Could not read cpu_freq from config.json, using default.");
            }
        }
        TimerCalculatorPanel.createOrShow(context.extensionUri, projectFreq);
    });
    context.subscriptions.push(timerCalcCommand);
}

export function deactivate() {
    Logger.dispose();
}
