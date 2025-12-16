import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface ProgrammerQuickPickItem extends vscode.QuickPickItem {
    programmer: any;
}

export async function pickProgrammer(
    context: vscode.ExtensionContext, 
    device: any, 
    defaultId?: string // Optional parameter for the current programmer ID (e.g. 'usbasp')
): Promise<ProgrammerQuickPickItem | undefined> {
    
    const progJsonPath = path.join(context.extensionPath, "data", "avrdude_programmer.json");

    try {
        const rawProgs = await fs.promises.readFile(progJsonPath, "utf8");
        const programmers = JSON.parse(rawProgs); 
        
        // Safety check: ensure we actually have an array
        if (!Array.isArray(programmers)) {
            throw new Error("Invalid JSON format: Root element is not an array.");
        }

        // Optional: Filter compatible programmers based on device modes if needed later.
        // For now, we take all of them.
        const compatibleProgs = programmers;

        let items: ProgrammerQuickPickItem[] = compatibleProgs.map((p: any) => ({
            // CORRECT MAPPING based on your JSON structure:
            // "prog" -> label (the ID used for avrdude -c)
            // "desc" -> description (human readable)
            // "modes" -> detail
            label: p.prog || "unknown", 
            description: p.desc || "",
            detail: `Modes: ${(p.modes || []).join(", ")}`,
            programmer: p
        }));

        // Sorting Logic: Move default programmer to the top
        if (defaultId) {
            items.sort((a, b) => {
                // We compare the labels (which correspond to 'prog' like 'usbasp')
                const labelA = a.label;
                const labelB = b.label;

                const isDefA = (labelA === defaultId);
                const isDefB = (labelB === defaultId);

                if (isDefA && !isDefB) {
                    return -1; // A comes first
                }
                if (!isDefA && isDefB) {
                    return 1;  // B comes first
                }
                
                // Otherwise sort alphabetically
                return labelA.localeCompare(labelB);
            });
        } else {
            // Sort alphabetically if no default is provided
            items.sort((a, b) => a.label.localeCompare(b.label));
        }

        return await vscode.window.showQuickPick<ProgrammerQuickPickItem>(items, {
            title: `Select Programmer for ${device.name || device.partno}`,
            placeHolder: defaultId ? `Current: ${defaultId}` : "Select a programmer...",
            matchOnDescription: true,
            matchOnDetail: true
        });

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to load programmer database: ${error instanceof Error ? error.message : error}`);
        return undefined;
    }
}