import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface DeviceQuickPickItem extends vscode.QuickPickItem {
    device: any;
}

function format(value: number): string {
    if (value === null || isNaN(value)) {
        return "0 Byte";
    }

    if (value >= 1024) {
        const kb = value / 1024;
        return `${kb} KB`;
    }

    return `${value} Byte`;
}

export async function pickDevice(context: vscode.ExtensionContext): Promise<DeviceQuickPickItem | undefined> {
    const deviceJsonPath = path.join(context.extensionPath, "data", "atmel_devices.json");

    try {
        // const rawDevices = fs.readFileSync(deviceJsonPath, "utf8");
        const rawDevices = await fs.promises.readFile(deviceJsonPath, "utf8");
        const deviceData = JSON.parse(rawDevices);

        const items: DeviceQuickPickItem[] = deviceData.devices
            .slice()
            .sort((a: any, b: any) => a.name.localeCompare(b.name))
            .map((dev: any) => ({
                label: dev.name,
                description: `Flash: ${format(dev.flash_bytes)}, EEPROM: ${format(dev.eeprom_bytes ?? 0)}`,
                detail: `Id: ${dev.id}, PartNo: ${dev.partno}`,
                device: dev
            }));

        return await vscode.window.showQuickPick<DeviceQuickPickItem>(items, {
            title: "Select Device",
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: "Type to search (e.g. ATmega328P or m328p) ..."
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to load device database: ${error instanceof Error ? error.message : error}`);
        return undefined;
    }
}
