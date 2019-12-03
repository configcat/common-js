import { IConfigCatLogger, LogLevel } from ".";

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

    log(message: string): void {       
        this.info(message);        
    }

    debug(message: string): void {
        if (this.isEnable(LogLevel.Debug)){
            console.log(this.SOURCE + " - DEBUG - " + message);
        }
    }

    info(message: string): void {
        if (this.isEnable(LogLevel.Info)) {
            console.info(this.SOURCE + " - INFO - " + message);
        }
    }

    warn(message: string): void {
        if (this.isEnable(LogLevel.Warn)) {
            console.warn(this.SOURCE + " - WARN - " + message);
        }
    }

    error(message: string): void {

        if (this.isEnable(LogLevel.Error)) {
            console.error(this.SOURCE + " - ERROR - " + message);
        }
    }

    isEnable(logLevel: LogLevel): boolean {
        return this.level >= logLevel;
    }    
}