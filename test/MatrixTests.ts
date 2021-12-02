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

    it("GetValue basic operators", (done) => {
        Helper.RunMatrixTest("test/data/sample_v5.json", "test/data/testmatrix.csv", done);
    })

    it("GetValue numeric operators", (done) => {
        Helper.RunMatrixTest("test/data/sample_number_v5.json", "test/data/testmatrix_number.csv", done);
    })

    it("GetValue semver operators", (done) => {
        Helper.RunMatrixTest("test/data/sample_semantic_v5.json", "test/data/testmatrix_semantic.csv", done);
    })

    it("GetValue semver operators", (done) => {
        Helper.RunMatrixTest("test/data/sample_semantic_2_v5.json", "test/data/testmatrix_semantic_2.csv", done);
    })

    it("GetValue sensitive operators", (done) => {
        Helper.RunMatrixTest("test/data/sample_sensitive_v5.json", "test/data/testmatrix_sensitive.csv", done);
    })

    class Helper {

        public static CreateUser(row: string, headers: string[]): User | undefined {

            let column: string[] = row.split(";");
            const USERNULL: string = "##null##";

            if (column[0] === USERNULL) {
                return undefined;
            }

            let result: User = new User(column[0]);

            if (column[1] !== USERNULL) {
                result.email = column[1];
            }

            if (column[2] !== USERNULL) {
                result.country = column[2];
            }

            if (column[3] !== USERNULL) {
                result.custom[headers[3]] = column[3];
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

            const SAMPLE: string = fs.readFileSync(sampleFilePath, "utf8");
            const CONFIG: ProjectConfig = new ProjectConfig(0, SAMPLE, '');

            let rowNo: number = 1;

            fs.readFile(matrixFilePath, "utf8", (e, data) => {

                if (e) {
                    throw e;
                }

                var lines: string[] = data.toString().split(EOL);
                let header: string[] = lines.shift()?.split(";") ?? [];

                lines.forEach((line: string): void => {

                    if (!line) {
                        return;
                    }

                    let user = Helper.CreateUser(line, header);

                    for (let i = 4; i < header.length; i++) {

                        let key: string = header[i];
                        let actual: any = evaluator.Evaluate(CONFIG, key, null, user).Value;
                        let expected: any = Helper.GetTypedValue(line.split(";")[i], key);

                        if (actual !== expected) {

                            let l = `Matrix test failed in line ${rowNo}.\n User: ${JSON.stringify(user)},\n Key: ${key},\n Actual: ${actual}, Expected: ${expected}`;
                            console.log(l);
                        }

                        assert.strictEqual(actual, expected);
                    }

                    rowNo++;
                }, complete());
            });
        }
    }
});