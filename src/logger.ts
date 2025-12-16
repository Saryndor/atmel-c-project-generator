import * as vscode from "vscode";

export class Logger {
    private static _outputChannel: vscode.OutputChannel;

    /**
     * Initializes the output channel. Should be called once in activate().
     * @param channelName The name displayed in the Output tab drop-down.
     */
    public static initialize(channelName: string) {
        if (!this._outputChannel) {
            this._outputChannel = vscode.window.createOutputChannel(channelName);
        }
    }

    /**
     * Logs an informational message with a timestamp.
     * @param message The message to log.
     */
    public static info(message: string) {
        if (this._outputChannel) {
            const time = new Date().toLocaleTimeString();
            this._outputChannel.appendLine(`[${time}] [INFO] ${message}`);
        }
    }


     /**
     * Logs an informational message with a timestamp.
     * @param message The message to log.
     */
    public static warn(message: string) {
        if (this._outputChannel) {
            const time = new Date().toLocaleTimeString();
            this._outputChannel.appendLine(`[${time}] [WARNING] ${message}`);
        }
    }

    /**
     * Logs an error message with a timestamp and optionally brings the channel to focus.
     * @param message The error message.
     * @param showChannel If true, the output panel is revealed to the user.
     */
    public static error(message: string, showChannel: boolean = true) {
        if (this._outputChannel) {
            const time = new Date().toLocaleTimeString();
            this._outputChannel.appendLine(`[${time}] [ERROR] ${message}`);
            
            if (showChannel) {
                this._outputChannel.show(true);
            }
        }
    }

    /**
     * Brings the output channel to focus.
     */
    public static show() {
        this._outputChannel?.show(true);
    }
    
    /**
     * Disposes the output channel.
     */
    public static dispose() {
        this._outputChannel?.dispose();
    }
}