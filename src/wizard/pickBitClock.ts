import * as vscode from "vscode";

/**
 * Shows a QuickPick to select the Bit Clock (-B) for avrdude.
 * This is useful for slow targets (e.g. factory default 1 MHz chips).
 * * @param context Extension context
 * @param defaultVal The current or default bit clock value (e.g. "5")
 * @returns The selected bit clock string (e.g. "10") or undefined if cancelled.
 */
export async function pickBitClock(
    context: vscode.ExtensionContext,
    defaultVal?: string | number
): Promise<string | undefined> {

    // Options matching the package.json enum descriptions
    const items: vscode.QuickPickItem[] = [
        { label: "5", description: "SPI-Freq. 187.5 kHz (Default)" },
        { label: "2000", description: "SPI-Freq. 500 Hz (Very Slow)" },
        { label: "1000", description: "SPI-Freq. 1 kHz" },
        { label: "500", description: "SPI-Freq. 2 kHz" },
        { label: "250", description: "SPI-Freq. 4 kHz" },
        { label: "125", description: "SPI-Freq. 8 kHz" },
        { label: "62", description: "SPI-Freq. 16 kHz" },
        { label: "31", description: "SPI-Freq. 32 kHz" },
        { label: "10", description: "SPI-Freq. 93.75 kHz (Standard for slow MCUs)" },
        { label: "2", description: "SPI-Freq. 375 kHz" },
        { label: "1", description: "SPI-Freq. 750 kHz" },
        { label: "0.5", description: "SPI-Freq. 1.5 MHz" },
        { label: "0.2", description: "SPI-Freq. 3 MHz (Fast)" }
    ];

    // Logic to move the currently selected default to the top of the list
    if (defaultVal !== undefined) {
        const defStr = String(defaultVal);
        items.sort((a, b) => {
            const isDefA = (a.label === defStr);
            const isDefB = (b.label === defStr);

            if (isDefA && !isDefB) { return -1; }
            if (!isDefA && isDefB) { return 1; }
            
            return 0; // Keep original order otherwise
        });
    }

    const selection = await vscode.window.showQuickPick(items, {
        title: "Select Bit Clock (-B)",
        placeHolder: defaultVal ? `Current: ${defaultVal} µs` : "Select bit clock period in µs",
        matchOnDescription: true
    });

    return selection ? selection.label : undefined;
}