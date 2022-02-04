import { IConfigCatLogger, LogLevel } from "./index";

export class ConfigCatConsoleLogger implements IConfigCatLogger {  

    SOURCE: string = "ConfigCat";

    public level: LogLevel = LogLevel.Warn;  

    /**
     * Create an instance of ConfigCatConsoleLogger
     */
    constructor(logLevel: LogLevel) {
        
        if (logLevel){
            this.level = logLevel;              
        }       
    }

    /**
     * @deprecated Use `debug(message: string)` method instead of this
     */
    log(message: string): void {       
        this.info(message);        
    }

    debug(message: string): void {
        if (this.isLogLevelEnabled(LogLevel.Debug)) {
            console.info(this.SOURCE + " - DEBUG - " + message);
        }
    }

    info(message: string): void {
        if (this.isLogLevelEnabled(LogLevel.Info)) {
            console.info(this.SOURCE + " - INFO - " + message);
        }
    }

    warn(message: string): void {
        if (this.isLogLevelEnabled(LogLevel.Warn)) {
            console.warn(this.SOURCE + " - WARN - " + message);
        }
    }

    error(message: string): void {

        if (this.isLogLevelEnabled(LogLevel.Error)) {
            console.error(this.SOURCE + " - ERROR - " + message);
        }
    }

    isLogLevelEnabled(logLevel: LogLevel): boolean {
        return this.level >= logLevel;
    }    
}