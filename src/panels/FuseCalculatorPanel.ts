import * as vscode from "vscode";
import * as path from "path";

import { pickDevice } from "../wizard/pickDevice";
import { pickProgrammer } from "../wizard/pickProgrammer";
import { pickBitClock } from "../wizard/pickBitClock";
import { Logger } from "../logger";

// Imports from the new modules
import { AvrDudeService, FuseHardwareConfig } from "../services/AvrDudeService";
import { FuseHtmlGenerator } from "../generators/FuseHtmlGenerator";

export class FuseCalculatorPanel {
    public static currentPanel: FuseCalculatorPanel | undefined;
    public static readonly viewType = "fuseCalculator";

    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext; 
    private _deviceData: any; 
    private _hardwareConfig: FuseHardwareConfig; 
    private _disposables: vscode.Disposable[] = [];

    // Service Instance
    private readonly _avrService: AvrDudeService;

    private constructor(
        panel: vscode.WebviewPanel, 
        context: vscode.ExtensionContext, 
        deviceData: any, 
        hardwareConfig: FuseHardwareConfig
    ) {
        this._panel = panel;
        this._context = context;
        this._deviceData = deviceData;
        this._hardwareConfig = hardwareConfig;
        
        // Initialize Service
        this._avrService = new AvrDudeService();

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case "readFuses":
                        await this.readFusesFromDevice();
                        return;
                    case "writeFuses":
                        await this.writeFusesToDevice(message.data);
                        return;
                    case "changeDevice":
                        await this.selectNewDevice();
                        return;
                    case "copyToClipboard":
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage("Command copied to clipboard!");
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(
        context: vscode.ExtensionContext, 
        deviceData: any, 
        hardwareConfig: FuseHardwareConfig
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (FuseCalculatorPanel.currentPanel) {
            FuseCalculatorPanel.currentPanel._panel.reveal(column);
            FuseCalculatorPanel.currentPanel.updateTarget(deviceData, hardwareConfig);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            FuseCalculatorPanel.viewType,
            `Fuse Calc: ${deviceData.name}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")]
            }
        );

        FuseCalculatorPanel.currentPanel = new FuseCalculatorPanel(
            panel, 
            context, 
            deviceData, 
            hardwareConfig
        );
    }

    public updateTarget(deviceData: any, hardwareConfig: FuseHardwareConfig) {
        this._deviceData = deviceData;
        this._hardwareConfig = hardwareConfig;
        this._update();
    }

    public dispose() {
        FuseCalculatorPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

  private async selectNewDevice() {
        Logger.info("Panel: User requested device change.");

        // 1. Pick Device
        const selection = await pickDevice(this._context);
        if (!selection) {
            return; 
        }

        // 2. Pick Programmer
        const currentProgId = this._hardwareConfig.programmer;
        const progSelection = await pickProgrammer(
            this._context, 
            selection.device, 
            currentProgId
        );
        
        if (!progSelection) {
            return; 
        }
        // Property in your JSON is "prog", not "id"
        const newProgrammer = progSelection.programmer.prog;

        // 3. Pick Port
        const currentPort = this._hardwareConfig.port || "usb";
        const newPort = await vscode.window.showInputBox({ 
            title: "Select Port",
            prompt: `Enter Port for ${newProgrammer}`,
            value: currentPort, 
            placeHolder: "usb, COM3, /dev/ttyUSB0"
        });
        
        if (newPort === undefined) {
            return; 
        }

        // 4. Pick BitClock
        // Use current value as default, fallback to "5"
        const currentClock = this._hardwareConfig.bitClock || "5";
        const newClock = await pickBitClock(this._context, currentClock);
        
        if (newClock === undefined) {
            return;
        }

        // 5. Update internal state
        this._deviceData = selection.device;
        this._hardwareConfig = {
            programmer: newProgrammer,
            partno: selection.device.partno,
            port: newPort,
            bitClock: newClock, // Store selected clock
            cwd: "." 
        };

        this._update();
        vscode.window.showInformationMessage(`Switched to ${this._deviceData.name || this._deviceData.partno} (${newProgrammer}, -B ${newClock})`);
    }

    private _update() {
        this._panel.title = `Fuse: ${this._deviceData.name}`;
        // Delegate HTML generation completely to the generator class
        this._panel.webview.html = FuseHtmlGenerator.generateFullPage(this._deviceData, this._hardwareConfig);
    }

    // --- Actions delegated to Service ---

    private async readFusesFromDevice() { 
        const registersToRead: string[] = this._deviceData.fuses_detailed.map((r: any) => r.name);
        
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Reading fuses...",
                cancellable: false
            }, async (progress) => {
                
                // Call the service to do the heavy lifting
                const newValues = await this._avrService.readFuses(this._hardwareConfig, registersToRead);

                this._panel.webview.postMessage({ command: "updateUI", values: newValues });
                vscode.window.showInformationMessage(`All fuses read successfully!`);
            });

        } catch (error: any) {
            Logger.error(`Panel: Read failed: ${error.message}`);
            vscode.window.showErrorMessage(`Read failed: ${error.message}`);
        }
    }

    private async writeFusesToDevice(messageData: any) { 
        const fuseValues = messageData.fuses;
        const isDryRun = messageData.dryRun;
        
        // Generate preview for confirmation message
        const cmdPreview = this._avrService.getWriteCommandPreview(this._hardwareConfig, fuseValues);
        const actionText = isDryRun ? "SIMULATE writing" : "WRITE";
        const argsAddon = isDryRun ? " (Dry Run)" : "";

        const answer = await vscode.window.showWarningMessage(
            `About to ${actionText} Fuses to ${this._hardwareConfig.partno}.\nCommand: ${cmdPreview}${argsAddon}\nContinue?`, 
            "Yes", "No"
        );
        if (answer !== "Yes") {
            return;
        }

        try {
            // Call Service
            const output = await this._avrService.writeFuses(this._hardwareConfig, fuseValues, isDryRun);
            
            Logger.info(`Panel: Write Output: ${output}`);

            if (isDryRun) {
                vscode.window.showInformationMessage("Dry Run successful! No changes were made.");
            } else {
                vscode.window.showInformationMessage("Fuses written successfully!");
            }
        } catch (error: any) {
            Logger.error(`Panel: Write failed: ${error.message}`);
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }
}