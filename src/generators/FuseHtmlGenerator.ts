import { FuseHardwareConfig } from "../services/AvrDudeService";

export class FuseHtmlGenerator {

    /**
     * Generates the complete HTML page for the Fuse Calculator Webview.
     * @param device The device data object.
     * @param config The current hardware configuration (programmer, partno, bitClock).
     */
    public static generateFullPage(device: any, config: FuseHardwareConfig): string {
        // Generate the inner list of fuse registers first
        const fusesHtml = this.generateFuseListHtml(device.fuses_detailed);
        
        // Inject current config into variables for the frontend script
        const hwPartNo = config.partno;
        const hwProg = config.programmer;
        const hwPort = config.port || "";
        // Handle bitClock: verify it exists, otherwise empty string
        const hwBitClock = config.bitClock ? String(config.bitClock) : "";

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Fuse Calculator</title>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); }
                    .fuse-register { background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); margin-bottom: 20px; padding: 15px; border-radius: 5px; }
                    .fuse-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                    .fuse-name { font-weight: bold; font-size: 1.1em; }
                    .hex-input { font-family: monospace; font-size: 1.2em; background: var(--vscode-input-background); color: var(--vscode-input-foreground); padding: 5px 10px; border: 1px solid var(--vscode-input-border); border-radius: 3px; width: 80px; text-align: center; }
                    .hex-input:focus { outline: 1px solid var(--vscode-focusBorder); }
                    .bitfield-row { display: flex; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--vscode-textBlockQuote-border); }
                    .bitfield-row:last-child { border-bottom: none; }
                    .bitfield-label { flex: 1; padding-right: 10px; }
                    .bitfield-mask { font-family: monospace; color: var(--vscode-descriptionForeground); font-size: 0.9em; margin-right: 15px; }
                    select { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); padding: 3px; }
                    .toolbar { margin-bottom: 15px; padding: 10px; background: var(--vscode-editor-lineHighlightBackground); border-radius: 5px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;}
                    .info-text { font-size: 0.9em; opacity: 0.9; margin-right: auto; line-height: 1.4em; }
                    button { padding: 8px 15px; cursor: pointer; border: none; border-radius: 3px; font-weight: bold; }
                    .btn-read { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
                    .btn-write { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
                    .btn-change { background: var(--vscode-editor-selectionBackground); color: var(--vscode-editor-foreground); }
                    .checkbox-label { display: flex; align-items: center; gap: 5px; cursor: pointer; font-weight: bold; margin-right: 10px; user-select: none; }
                    .checkbox-label input { cursor: pointer; }
                    .command-box { margin-bottom: 20px; padding: 10px; background: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textBlockQuote-border); border-radius: 3px; display: flex; align-items: center; gap: 10px; }
                    .command-text { font-family: monospace; flex: 1; word-break: break-all; font-size: 1.05em; }
                    .btn-copy { background: transparent; border: 1px solid var(--vscode-button-secondaryBackground); color: var(--vscode-foreground); padding: 5px 10px; font-size: 1.2em; cursor: pointer; }
                    .btn-copy:hover { background: var(--vscode-list-hoverBackground); }
                </style>
            </head>
            <body>
                <h1>Fuse Calculator: ${device.name}</h1>
                
                <div class="toolbar">
                    <div class="info-text">
                        Programmer: <strong>${config.programmer}</strong> <br>
                        Part: <strong>${config.partno}</strong> <br>
                        Clock (-B): <strong>${hwBitClock ? hwBitClock + " µs" : "Default"}</strong>
                    </div>

                    <label class="checkbox-label" title="Simulate without writing to the chip">
                        <input type="checkbox" id="chk-dryrun" checked> Dry Run
                    </label>

                    <button id="btn-read" class="btn-read">⬇️ Read</button>
                    <button id="btn-write" class="btn-write">⚡ Program</button>
                    <button id="btn-change" class="btn-change">🔄 Change Device</button>
                </div>

                <div class="command-box">
                    <div class="command-text" id="cmd-preview">Calculating command...</div>
                    <button id="btn-copy" class="btn-copy" title="Copy to Clipboard">📋</button>
                </div>

                <div id="fuses-container">
                    ${fusesHtml}
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    const regMap = { "LOW": "lfuse", "HIGH": "hfuse", "EXTENDED": "efuse", "LOCKBIT": "lock" };
                    
                    // Hardware config injected from backend
                    const hwPartNo = "${hwPartNo}";
                    const hwProg = "${hwProg}";
                    const hwPort = "${hwPort}";
                    const hwBitClock = "${hwBitClock}";

                    // --- Handlers ---
                    document.getElementById('btn-read').addEventListener('click', () => {
                        vscode.postMessage({ command: 'readFuses' });
                    });
                    
                    document.getElementById('btn-change').addEventListener('click', () => {
                        vscode.postMessage({ command: 'changeDevice' });
                    });

                    document.getElementById('btn-write').addEventListener('click', () => {
                        const payload = gatherAllValues();
                        const isDryRun = document.getElementById('chk-dryrun').checked;
                        vscode.postMessage({ command: 'writeFuses', data: { fuses: payload, dryRun: isDryRun } });
                    });

                    document.getElementById('btn-copy').addEventListener('click', () => {
                        const text = document.getElementById('cmd-preview').innerText;
                        vscode.postMessage({ command: 'copyToClipboard', text: text });
                    });

                    document.getElementById('chk-dryrun').addEventListener('change', () => {
                        updateCommandPreview();
                    });

                    document.querySelectorAll('select, input[type="checkbox"]:not(#chk-dryrun)').forEach(el => {
                        el.addEventListener('change', (e) => {
                             const regName = e.target.dataset.reg;
                             recalculateHexFromInputs(regName);
                             updateCommandPreview();
                        });
                    });

                    document.querySelectorAll('.hex-input').forEach(el => {
                        el.addEventListener('input', (e) => {
                             const regName = e.target.dataset.reg;
                             const hexStr = e.target.value;
                             let val = parseInt(hexStr, 16);
                             if (!isNaN(val)) {
                                 val = val & 0xFF;
                                 applyValueToRegisterUI(regName, val);
                                 updateCommandPreview();
                             }
                        });
                    });

                    function gatherAllValues() {
                        const payload = {};
                        document.querySelectorAll('.fuse-register').forEach(regDiv => {
                            const regName = regDiv.id.replace('reg-', '');
                            const hexInput = document.getElementById(\`hex-\${regName}\`);
                            const val = parseInt(hexInput.value, 16);
                            if (!isNaN(val)) {
                                payload[regName] = val;
                            }
                        });
                        return payload;
                    }

                    function recalculateHexFromInputs(regName) {
                        const inputs = document.querySelectorAll(\`[data-reg="\${regName}"]:not(.hex-input)\`);
                        const regDiv = document.getElementById(\`reg-\${regName}\`);
                        const defaultVal = parseInt(regDiv.dataset.default, 10);
                        let calculated = defaultVal;

                        inputs.forEach(input => {
                            const mask = parseInt(input.dataset.mask, 10);
                            calculated &= ~mask; 
                            let val = 0;
                            if (input.tagName === 'SELECT') {
                                val = parseInt(input.value, 10);
                            } else if (input.type === 'checkbox') {
                                val = input.checked ? 0 : mask;
                            }
                            calculated |= (val & mask);
                        });

                        const hexInput = document.getElementById(\`hex-\${regName}\`);
                        hexInput.value = "0x" + calculated.toString(16).toUpperCase().padStart(2, '0');
                    }

                    function applyValueToRegisterUI(regName, byteVal) {
                        const inputs = document.querySelectorAll(\`[data-reg="\${regName}"]:not(.hex-input)\`);
                        inputs.forEach(input => {
                            const mask = parseInt(input.dataset.mask, 10);
                            const fieldVal = byteVal & mask;
                            if (input.tagName === 'SELECT') {
                                input.value = fieldVal;
                            } else if (input.type === 'checkbox') {
                                input.checked = (fieldVal === 0);
                            }
                        });
                    }

                    function updateCommandPreview() {
                        const values = gatherAllValues();
                        const isDryRun = document.getElementById('chk-dryrun').checked;
                        
                        let cmd = "avrdude -p " + hwPartNo + " -c " + hwProg;
                        
                        if (hwPort) {
                            cmd += " -P " + hwPort;
                        }

                        // Updated: Add bit clock if present
                        if (hwBitClock) {
                            cmd += " -B " + hwBitClock;
                        }

                        if (isDryRun) {
                            cmd += " -n";
                        }

                        for (const [regName, val] of Object.entries(values)) {
                            const avrName = regMap[regName];
                            if (avrName) {
                                const hexVal = "0x" + val.toString(16).toUpperCase().padStart(2, '0');
                                cmd += \` -U \${avrName}:w:\${hexVal}:m\`;
                            }
                        }
                        
                        document.getElementById('cmd-preview').innerText = cmd;
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'updateUI') {
                             const newValues = message.values;
                             for (const [regName, hexVal] of Object.entries(newValues)) {
                                applyValueToRegisterUI(regName, hexVal);
                                document.getElementById(\`hex-\${regName}\`).value = "0x" + hexVal.toString(16).toUpperCase().padStart(2, '0');
                            }
                            updateCommandPreview();
                        }
                    });

                    // Init
                    document.querySelectorAll('.fuse-register').forEach(div => {
                        const regName = div.id.replace('reg-', '');
                        recalculateHexFromInputs(regName);
                    });
                    updateCommandPreview();
                </script>
            </body>
            </html>`;
    }

    private static generateFuseListHtml(fusesDetailed: any[]): string {
        if (!fusesDetailed || fusesDetailed.length === 0) {
            return "<p>No detailed fuse definitions found for this device.</p>";
        }

        let html = "";
        fusesDetailed.forEach((fuseReg: any) => {
            html += this.generateRegisterHtml(fuseReg);
        });
        return html;
    }

    private static generateRegisterHtml(reg: any): string {
        const hexDefault = "0x" + reg.default.toString(16).toUpperCase().padStart(2, '0');
        
        let fieldsHtml = "";
        const sortedFields = [...reg.bitfields].sort((a: any, b: any) => b.mask - a.mask);

        sortedFields.forEach((field: any) => {
            fieldsHtml += `<div class="bitfield-row">
                <div class="bitfield-label" title="${field.name}">
                    ${field.caption || field.name}
                </div>
                <div class="bitfield-mask">Mask: 0x${field.mask.toString(16).toUpperCase()}</div>
                <div class="bitfield-input">
                    ${this.generateInputForField(reg.name, field, reg.default)}
                </div>
            </div>`;
        });

        return `
        <div class="fuse-register" id="reg-${reg.name}" data-default="${reg.default}">
            <div class="fuse-header">
                <span class="fuse-name">${reg.name} Register</span>
                <input type="text" class="hex-input" id="hex-${reg.name}" data-reg="${reg.name}" value="${hexDefault}" maxlength="4" />
            </div>
            ${fieldsHtml}
        </div>`;
    }

    private static generateInputForField(regName: string, field: any, defaultRegVal: number): string {
        const currentVal = defaultRegVal & field.mask;

        // Enum Dropdown
        if (field.values && field.values.length > 0) {
            let options = "";
            field.values.forEach((v: any) => {
                const isSelected = (v.value === currentVal) ? "selected" : "";
                options += `<option value="${v.value}" ${isSelected}>${v.label || v.name}</option>`;
            });
            return `<select data-reg="${regName}" data-mask="${field.mask}">${options}</select>`;
        }
        
        // Checkbox
        const isProgrammed = (currentVal === 0); 
        const checked = isProgrammed ? "checked" : "";
        
        return `<input type="checkbox" data-reg="${regName}" data-mask="${field.mask}" ${checked} />`;
    }
}