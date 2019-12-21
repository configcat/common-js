import { assert } from "chai";
import "mocha";
import * as fs from "fs";
import { RolloutEvaluator, User } from "../src/RolloutEvaluator";
import { ProjectConfig } from "../src/ProjectConfig";
import { ConfigCatConsoleLogger } from "../src/ConfigCatLogger";
import { LogLevel, IConfigCatLogger } from "../src";

describe("MatrixTests", () => {

    const EOL: string = require("os").EOL;
    let logger: IConfigCatLogger = new ConfigCatConsoleLogger(LogLevel.Off);
    let evaluator: RolloutEvaluator = new RolloutEvaluator(logger);

    it("GetValue basic operators", (done) =>{
        Helper.RunMatrixTest("test/sample_v3.json", "test/testmatrix.csv", done);
    })

    it("GetValue numeric operators", (done) =>{
        Helper.RunMatrixTest("test/sample_number_v3.json", "test/testmatrix_number.csv", done);
    })

    it("GetValue semver operators", (done) =>{
        Helper.RunMatrixTest("test/sample_semantic_v3.json", "test/testmatrix_semantic.csv", done);
    }) 

    it("GetValue semver operators", (done) =>{
        Helper.RunMatrixTest("test/sample_semantic_2_v3.json", "test/testmatrix_semantic_2.csv", done);
    }) 

    class Helper {

        public static CreateUser(row: string, headers: string[]): User {

            let up: string[] = row.split(";");
            const USERNULL:string = "##null##";

            if (up[0] === USERNULL) {
                return null;
            }

            let result: User = new User(up[0]);

            if (up[1] !== USERNULL){
                result.email = up[1];
            }

            if (up[2] !== USERNULL){
                result.country = up[2];
            }

            if (up[3] !== USERNULL){
                result.custom[headers[3]] = up[3];
            }

            return result;
        }

        public static GetTypedValue(value: string, header: string): string | boolean | number {

            if (header.substring(0, "bool".length) === "bool") {
                return value.toLowerCase() === "true";
            }

            if (header.substring(0, "double".length) === "double") {
                return +value;
            }

            if (header.substring(0, "integer".length) === "integer") {
                return +value;
            }

            return value;
        }

        public static RunMatrixTest(sampleFilePath: string, matrixFilePath: string, complete: () => void) {
            
            const ENCODING: string = "utf8";
            const SAMPLE: string = fs.readFileSync(sampleFilePath, ENCODING);
            const CONFIG: ProjectConfig = new ProjectConfig(0, SAMPLE, null);            

            let header: string[];
            let rowNo: number = 1;        

            fs.readFile(matrixFilePath, ENCODING, (e, data) => {

                if (e) {
                    throw e;
                }

                var lines: string[] = data.toString().split(EOL);
                lines.forEach(function (line: string): void {

                    if (header) {

                        if (!line) {
                            return;
                        }

                        let user: User = Helper.CreateUser(line, header);

                        for (let i: number = 4; i < header.length; i++) {

                            let key: string = header[i];

                            let actual: any = evaluator.Evaluate(CONFIG, key, null, user);

                            let expected: any = Helper.GetTypedValue(line.split(";")[i], key);

                            if (actual !== expected) {

                                // tslint:disable-next-line:max-line-length
                                let l: string = <string><any>rowNo + "." + " User -  " + user + "(" + <string>key + ") " + <string><any>actual + " === " + <string><any>expected + " = " + <string><any>(actual === expected);

                                console.log(l);
                            }

                            // assert
                            assert.strictEqual(actual, expected);
                        }

                    } else {
                        header = line.split(";");
                    }
                    
                    rowNo++;
                }, complete());
            });
        }
    }
});