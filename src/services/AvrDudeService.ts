import * as cp from "child_process";
import { Logger } from "../logger";

// Definition of the hardware configuration used across the extension
export interface FuseHardwareConfig {
    programmer: string;
    partno: string;
    port?: string; 
    bitClock?: string | number; // Added bitClock support
    cwd?: string;  
}

export class AvrDudeService {
    
    /**
     * Reads specific fuses from the device.
     */
    public async readFuses(config: FuseHardwareConfig, registers: string[]): Promise<{[key: string]: number}> {
        const map: {[key: string]: string} = { "LOW": "lfuse", "HIGH": "hfuse", "EXTENDED": "efuse", "LOCKBIT": "lock" };
        const results: {[key: string]: number} = {};
        
        // Use helper to construct hardware arguments (-p -c -P -B)
        const hwArgs = this.getHardwareArgs(config);

        Logger.info(`AvrDudeService: Starting read for ${config.partno} on ${config.programmer} (Args: ${hwArgs})`);

        for (const regName of registers) {
            const avrName = map[regName];
            if (!avrName) {
                continue;
            }

            // Construct the command
            const cmd = `avrdude ${hwArgs} -U ${avrName}:r:-:h`;
            
            // Execute the command
            const output = await this.execShell(cmd, config.cwd || ".");
            const cleanHex = output.trim();
            const intVal = parseInt(cleanHex, 16);

            if (isNaN(intVal)) {
                throw new Error(`Invalid output for ${regName}: "${cleanHex}"`);
            }
            
            results[regName] = intVal;
            Logger.info(`AvrDudeService: Read ${regName} = 0x${cleanHex}`);
        }

        return results;
    }

    /**
     * Writes fuse values to the device.
     */
    public async writeFuses(config: FuseHardwareConfig, fuseValues: {[key: string]: number}, dryRun: boolean): Promise<string> {
        const map: {[key: string]: string} = { "LOW": "lfuse", "HIGH": "hfuse", "EXTENDED": "efuse", "LOCKBIT": "lock" };
        let args = "";

        // Add dry run flag if requested
        if (dryRun) {
            args += " -n";
        }

        // Build the -U arguments for each fuse
        for (const [regName, val] of Object.entries(fuseValues)) {
            const avrName = map[regName];
            if (avrName) {
                const hexVal = "0x" + (val as number).toString(16).toUpperCase();
                args += ` -U ${avrName}:w:${hexVal}:m`;
            }
        }

        if (args.trim() === "" || args.trim() === "-n") {
            throw new Error("No fuse values provided to write.");
        }

        // Use helper for hardware args
        const hwArgs = this.getHardwareArgs(config);
        const cmd = `avrdude ${hwArgs} ${args}`;
        
        Logger.info(`AvrDudeService: Executing ${cmd}`);

        return await this.execShell(cmd, config.cwd || ".");
    }

    /**
     * Helper to generate the command preview string for UI display.
     */
    public getWriteCommandPreview(config: FuseHardwareConfig, fuseValues: {[key: string]: number}): string {
        const map: {[key: string]: string} = { "LOW": "lfuse", "HIGH": "hfuse", "EXTENDED": "efuse", "LOCKBIT": "lock" };
        
        // Use helper here too
        let cmd = `avrdude ${this.getHardwareArgs(config)}`;
        
        for (const [regName, val] of Object.entries(fuseValues)) {
            const avrName = map[regName];
            if (avrName) {
                const hexVal = "0x" + (val as number).toString(16).toUpperCase().padStart(2, '0');
                cmd += ` -U ${avrName}:w:${hexVal}:m`;
            }
        }
        return cmd;
    }

    /**
     * Constructs the common hardware arguments for avrdude.
     * Includes Partno (-p), Programmer (-c), Port (-P) and BitClock (-B).
     */
    private getHardwareArgs(config: FuseHardwareConfig): string {
        let args = ` -p ${config.partno} -c ${config.programmer}`;
        
        // Append Port if defined
        if (config.port && config.port.trim().length > 0) {
            args += ` -P ${config.port}`;
        }

        // Append BitClock if defined
        if (config.bitClock) {
            const sClock = String(config.bitClock).trim();
            if (sClock.length > 0) {
                args += ` -B ${sClock}`;
            }
        }

        return args;
    }

    /**
     * Executes a shell command in a promise wrapper.
     */
    private execShell(cmd: string, cwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.exec(cmd, { cwd: cwd }, (err, stdout, stderr) => {
                if (err) {
                    // AVRDUDE writes progress information to stderr, but if 'err' is set, 
                    // the process actually failed (exit code != 0).
                    reject(new Error(stderr || err.message));
                } else {
                    resolve(stdout.toString());
                }
            });
        });
    }
}