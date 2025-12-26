import * as vscode from 'vscode';

/**
 * Manages the AVR Timer Calculator Webview.
 */
export class TimerCalculatorPanel {
    public static currentPanel: TimerCalculatorPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private readonly _initialFreqMHz: number;

    private constructor(panel: vscode.WebviewPanel, initialFreqHz: number) {
        this._panel = panel;
        // Convert Hz to MHz for the UI (e.g. 16000000 -> 16)
        this._initialFreqMHz = initialFreqHz / 1000000;
        
        this._panel.webview.html = this._getWebviewContent();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'calculate':
                        this._calculateTimer(message.data);
                        return;
                    case 'copyToClipboard':
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Code copied to clipboard!');
                        return;
                }
            },
            null,
            this._disposables
        );

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    /**
     * Creates or shows the panel.
     * @param extensionUri The extension URI.
     * @param initialFreqHz The CPU frequency in Hz (default: 16MHz).
     */
    public static createOrShow(extensionUri: vscode.Uri, initialFreqHz: number = 16000000) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (TimerCalculatorPanel.currentPanel) {
            TimerCalculatorPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'atmelTimerCalc',
            'AVR Timer Calculator',
            column || vscode.ViewColumn.One,
            { enableScripts: true }
        );

        TimerCalculatorPanel.currentPanel = new TimerCalculatorPanel(panel, initialFreqHz);
    }

    public dispose() {
        TimerCalculatorPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) { x.dispose(); }
        }
    }

    private _calculateTimer(data: any) {
        // Inputs
        const fCpuMHz = parseFloat(data.fCpu);
        const fCpu = fCpuMHz * 1000000; // Convert to Hz
        
        const targetTime = parseFloat(data.targetTime); // Seconds
        const timerBits = parseInt(data.timerBits); // 8 or 16
        
        const prescalers = [1, 8, 64, 256, 1024];
        let results = [];

        const maxTimerCounts = Math.pow(2, timerBits); // 256 or 65536

        for (let p of prescalers) {
            // 1. Total Ticks required for this duration at this prescaler
            // Formula: Ticks = Time * (F_CPU / Prescaler)
            const totalTicksRaw = targetTime * (fCpu / p);
            
            // 2. How many full overflows?
            const overflowCount = Math.floor(totalTicksRaw / maxTimerCounts);
            
            // 3. Remainder ticks (what is left for the OCR)
            const remainderTicks = Math.round(totalTicksRaw % maxTimerCounts);
            
            // 4. Calculate OCR for CTC (TotalTicks - 1 because 0-indexed)
            // Only valid if it fits in one cycle (Overflow == 0) and Ticks >= 1
            let ocrVal = -1;
            let realTime = 0;
            let errorPercent = 0;
            let isValidCTC = false;

            if (overflowCount === 0 && totalTicksRaw >= 1) {
                // Fits in hardware timer
                ocrVal = Math.round(totalTicksRaw) - 1;
                // Clamp to min 0
                if (ocrVal < 0) {ocrVal = 0;}

                // Re-calculate Real Time based on rounded OCR
                // Time = (OCR + 1) * Prescaler / FCpu
                realTime = ((ocrVal + 1) * p) / fCpu;
                isValidCTC = true;
            } else {
                // Too long for single hardware cycle
                // Real time calculation based on total raw ticks rounded
                realTime = Math.round(totalTicksRaw) * p / fCpu;
                isValidCTC = false;
            }

            // Calculate Error
            if (targetTime !== 0) {
                 errorPercent = ((realTime - targetTime) / targetTime) * 100;
            }

            // Generate Code Snippet
            const codeSnippet = this._generateCode(timerBits, p, ocrVal, isValidCTC);

            results.push({
                prescaler: p,
                totalTicks: Math.round(totalTicksRaw),
                overflows: overflowCount,
                remainder: remainderTicks,
                ocr: isValidCTC ? ocrVal : "N/A", // Only show OCR if it fits
                realTime: realTime.toFixed(6), // Show more precision for seconds
                error: Math.abs(errorPercent).toFixed(4),
                isValid: isValidCTC,
                code: codeSnippet
            });
        }

        this._panel.webview.postMessage({ command: 'showResults', results: results });
    }

    private _generateCode(bits: number, prescaler: number, ocr: number, isValid: boolean): string {
        if (!isValid) {
             return "// Configuration requires software counter or larger prescaler.\\n// Hardware timer cannot handle this duration in a single cycle.";
        }

        // --- Configuration Logic ---
        // Determine Prescaler Bits (CSn2, CSn1, CSn0)
        // Standard AVR mapping for Timer0/1 (check datasheet for specifics!)
        // 1 = /1, 2 = /8, 3 = /64, 4 = /256, 5 = /1024
        let csConfig = "";
        if (prescaler === 1)    { csConfig = "(1 << CS10)"; }
        if (prescaler === 8)    { csConfig = "(1 << CS11)"; }
        if (prescaler === 64)   { csConfig = "(1 << CS11) | (1 << CS10)"; }
        if (prescaler === 256)  { csConfig = "(1 << CS12)"; }
        if (prescaler === 1024) { csConfig = "(1 << CS12) | (1 << CS10)"; } 

        // Variables based on bit width (assuming Standard ATmega naming)
        const tName = bits === 16 ? "1" : "0";
        const regTCCRA = `TCCR${tName}A`;
        const regTCCRB = `TCCR${tName}B`;
        const regOCR   = `OCR${tName}A`;
        const regTIMSK = `TIMSK${tName}`;
        const vectName = `TIMER${tName}_COMPA_vect`;
        
        // Timer 1 (16-bit) usually uses WGM12 for CTC.
        // Timer 0 (8-bit) usually uses WGM01 for CTC.
        const wgmBit = bits === 16 ? "WGM12" : "WGM01";

        // Fix for 8-bit timer CS bits naming (usually CS02, CS01, CS00) vs 16-bit (CS12, CS11, CS10)
        // We do a simple string replace to adjust the generic csConfig string created above
        let specificCsConfig = csConfig;
        if (bits === 8) {
            specificCsConfig = specificCsConfig.replace(/CS1/g, "CS0");
        }

        return `/*
 * Timer ${tName} Configuration (CTC Mode)
 * Target: ${ocr + 1} ticks @ Prescaler ${prescaler}
 * CAUTION: Register names (TCCR${tName}A, etc.) follow ATmega328P standard.
 * Check your specific MCU datasheet if registers differ (e.g. ATtiny).
 */

// 1. Reset Control Registers
${regTCCRA} = 0;
${regTCCRB} = 0;

// 2. Set CTC Mode (Clear Timer on Compare Match)
${regTCCRB} |= (1 << ${wgmBit});

// 3. Set Prescaler to ${prescaler}
${regTCCRB} |= ${specificCsConfig};

// 4. Set Compare Match Value
${regOCR} = ${ocr};

// 5. Enable Compare Match Interrupt
${regTIMSK} |= (1 << OCIE${tName}A);

// --- Interrupt Service Routine ---
ISR(${vectName}) {
    // TODO: Execute periodic code here
}`;
    }

    private _getWebviewContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AVR Timer Calculator</title>
            <style>
                :root {
                    --font-size-base: 16px; /* Increased Font Size */
                }
                body { 
                    font-family: var(--vscode-font-family); 
                    font-size: var(--font-size-base);
                    padding: 20px; 
                    color: var(--vscode-editor-foreground); 
                    background-color: var(--vscode-editor-background); 
                }
                .container { max-width: 900px; margin: 0 auto; }
                
                /* Form Styling */
                .input-group { margin-bottom: 20px; }
                label { display: block; margin-bottom: 8px; font-weight: bold; font-size: 1.1em; }
                input, select { 
                    width: 100%; 
                    padding: 12px; 
                    font-size: 1.1em; 
                    background: var(--vscode-input-background); 
                    color: var(--vscode-input-foreground); 
                    border: 1px solid var(--vscode-input-border); 
                    box-sizing: border-box;
                    border-radius: 4px;
                }
                input:focus, select:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                }
                
                button.calc-btn { 
                    margin-top: 15px; 
                    width: 100%; 
                    padding: 14px; 
                    background: var(--vscode-button-background); 
                    color: var(--vscode-button-foreground); 
                    border: none; 
                    border-radius: 4px;
                    cursor: pointer; 
                    font-size: 1.2em; 
                    font-weight: bold; 
                }
                button.calc-btn:hover { background: var(--vscode-button-hoverBackground); }

                /* Table Styling */
                table { width: 100%; border-collapse: collapse; margin-top: 35px; font-size: 1em; }
                th, td { 
                    border: 1px solid var(--vscode-panel-border); 
                    padding: 12px 10px; 
                    text-align: left; 
                }
                th { 
                    background-color: var(--vscode-editor-lineHighlightBackground); 
                    font-weight: bold; 
                    text-transform: uppercase;
                    font-size: 0.9em;
                }
                
                /* Utility Classes */
                .valid-row { border-left: 6px solid #4caf50; background-color: rgba(76, 175, 80, 0.05); }
                .invalid-row { opacity: 0.6; }
                
                .code-btn {
                    padding: 8px 12px;
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 0.95em;
                }
                .code-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
                
                .note { 
                    font-size: 0.85em; 
                    color: var(--vscode-descriptionForeground); 
                    margin-top: 5px; 
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>AVR Timer Calculator</h2>
                
                <div class="input-group">
                    <label>CPU Frequency (MHz):</label>
                    <input type="number" id="fCpu" value="${this._initialFreqMHz}">
                    <div class="note">Value loaded from config.json (if available)</div>
                </div>
                
                <div class="input-group">
                    <label>Target Time (seconds):</label>
                    <input type="number" id="targetTime" value="0.001" step="0.000001">
                    <div class="note">e.g., 0.001 for 1ms, 1.0 for 1s</div>
                </div>
                
                <div class="input-group">
                    <label>Timer Width:</label>
                    <select id="timerBits">
                        <option value="8">8-bit (Timer0 / Timer2) [Max 256]</option>
                        <option value="16">16-bit (Timer1) [Max 65536]</option>
                    </select>
                </div>

                <button class="calc-btn" onclick="calculate()">Calculate Settings</button>

                <div id="results"></div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function calculate() {
                    const fCpu = document.getElementById('fCpu').value;
                    const targetTime = document.getElementById('targetTime').value;
                    const timerBits = document.getElementById('timerBits').value;

                    vscode.postMessage({
                        command: 'calculate',
                        data: { fCpu, targetTime, timerBits }
                    });
                }

                function copyCode(encodedCode) {
                    const code = decodeURIComponent(encodedCode);
                    vscode.postMessage({
                        command: 'copyToClipboard',
                        text: code
                    });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'showResults':
                            displayResults(message.results);
                            break;
                    }
                });

                function displayResults(results) {
                    const container = document.getElementById('results');
                    if (!results || results.length === 0) return;

                    let html = '<table><thead><tr>' +
                        '<th>Prescaler</th>' +
                        '<th>OCR (Reg)</th>' +
                        '<th>Total Ticks</th>' +
                        '<th>Overflows</th>' +
                        '<th>Remainder</th>' +
                        '<th>Real Time (s)</th>' +
                        '<th>Action</th>' +
                        '</tr></thead><tbody>';
                    
                    results.forEach(r => {
                        const rowClass = r.isValid ? 'valid-row' : 'invalid-row';
                        const ocrDisplay = r.isValid ? '<strong>' + r.ocr + '</strong>' : '<span style="color:var(--vscode-errorForeground)">Too Large</span>';
                        
                        // Encode code for button attribute to avoid quote issues
                        const codeEncoded = encodeURIComponent(r.code);

                        html += \`<tr class="\${rowClass}">
                            <td>\${r.prescaler}</td>
                            <td>\${ocrDisplay}</td>
                            <td>\${r.totalTicks}</td>
                            <td>\${r.overflows}</td>
                            <td>\${r.remainder}</td>
                            <td>\${r.realTime} <br><small>(Err: \${r.error}%)</small></td>
                            <td>\`;
                        
                        if (r.isValid) {
                             html += \`<button class="code-btn" onclick="copyCode('\${codeEncoded}')">Copy Code</button>\`;
                        } else {
                             html += \`<span style="font-size:0.8em; opacity:0.7">Software Timer req.</span>\`;
                        }
                        
                        html += \`</td></tr>\`;
                    });
                    html += '</tbody></table>';
                    
                    // Add legend
                    html += '<div style="margin-top:15px; font-size:0.9em; opacity:0.8"><span style="color:#4caf50; font-weight:bold; border-left: 6px solid #4caf50; padding-left: 5px;">Green bar</span> indicates hardware CTC mode is possible (fits in register).</div>';
                    
                    container.innerHTML = html;
                }
            </script>
        </body>
        </html>`;
    }
}