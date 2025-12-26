import * as path from "path";

/**
 * Interface defining the raw configuration data.
 */
export interface ProjectOptions {
    project: string;
    rootPath: string;
    mcu: string;          // Technical name for GCC (e.g. "attiny13")
    partno: string;       // Part number for AVRDUDE (e.g. "t13")
    frequency: number;    // Clock frequency in Hz
    programmer: string;
    port?: any;
    bitClock?: any;     
    ioDef: string;        
}

/**
 * Represents the configuration of an AVR project.
 * Acts as the Single Source of Truth for generating derived values.
 */
export class ProjectConfig {
    private readonly options: ProjectOptions;

    constructor(options: ProjectOptions) {
        this.options = options;
    }

    // -- Getters for raw data --

    public get project(): string { return this.options.project; }
    public get rootPath(): string { return this.options.rootPath; }
    public get mcu(): string { return this.options.mcu; }
    public get partno(): string { return this.options.partno; } // Expose distinct partno
    public get frequency(): number { return this.options.frequency; }
    public get programmer(): string { return this.options.programmer; }
    public get port(): string { return this.options.port; }
    public get bitClock(): number { return this.options.bitClock; }

    public get vscodeDir(): string {
        return path.join(this.options.rootPath, ".vscode");
    }

    public get ioDefine(): string {
        return this.options.ioDef;
    }

    public getPreprocessorDefines(): string[] {
        return [
            this.ioDefine,
            `F_CPU=${this.options.frequency}UL`
        ];
    }

    /**
     * Generates the dictionary of variables used for Makefile and Template replacement.
     */
    public getTemplateVars(): { [key: string]: string } {
        return {
            PROJECT: this.options.project,
            MCU: this.options.mcu,
            PARTNO: this.options.partno, // Use the correct AVRDUDE partno here!
            CPU_FREQ: this.options.frequency.toString(),
            PROGRAMMER: this.options.programmer,
            PORT: this.options.port,
            BITCLOCK: this.options.bitClock.toString(),
            IO_DEF: this.ioDefine
        };
    }
    
    /**
     * Serializes the configuration for storage in config.json.
     */
    public toConfigJson(): any {
        return {
            id: "atmel-project-config",
            project: this.options.project,
            mcu: this.options.mcu,
            partno: this.options.partno, // Save distinct partno
            cpu_freq: this.options.frequency,
            programmer: this.options.programmer,
            port: this.options.port,
            bitClock: this.options.bitClock,
            io_def: this.ioDefine
        };
    }
    
}