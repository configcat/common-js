import { assert } from "chai";
import "mocha";
import * as fs from "fs";
import { User } from "../src/RolloutEvaluator";
import { ConfigCatConsoleLogger } from "../src/ConfigCatLogger";
import { LogLevel, createClientWithManualPoll } from "../src";
import { FakeConfigCatKernel, FakeConfigFetcherBase } from "./ConfigCatClientTests";

describe("MatrixTests", () => {

    const EOL: string = require("os").EOL;

    it("GetValue basic operators", async () => {
        await Helper.RunMatrixTest("test/data/sample_v5.json", "test/data/testmatrix.csv");
    })

    it("GetValue numeric operators", async () => {
        await Helper.RunMatrixTest("test/data/sample_number_v5.json", "test/data/testmatrix_number.csv");
    })

    it("GetValue semver operators", async () => {
        await Helper.RunMatrixTest("test/data/sample_semantic_v5.json", "test/data/testmatrix_semantic.csv");
    })

    it("GetValue semver operators", async () => {
        await Helper.RunMatrixTest("test/data/sample_semantic_2_v5.json", "test/data/testmatrix_semantic_2.csv");
    })

    it("GetValue sensitive operators", async () => {
        await Helper.RunMatrixTest("test/data/sample_sensitive_v5.json", "test/data/testmatrix_sensitive.csv");
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
                result.custom = result.custom || {};
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

        public static async RunMatrixTest(sampleFilePath: string, matrixFilePath: string): Promise<void> {

            const SAMPLE: string = fs.readFileSync(sampleFilePath, "utf8");
            let configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherBase(SAMPLE) };
            const client = createClientWithManualPoll("SDKKEY", configCatKernel, {
                logger: new ConfigCatConsoleLogger(LogLevel.Off)
            });

            await client.forceRefreshAsync();

            const data = fs.readFileSync(matrixFilePath, "utf8");

            var lines: string[] = data.toString().split(EOL);
            let header: string[] = lines.shift()?.split(";") ?? [];

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                let line = lines[lineIndex];

                if (!line) {
                    return;
                }

                let user = Helper.CreateUser(line, header);

                for (let i = 4; i < header.length; i++) {

                    let key: string = header[i];
                    let actual: any = await client.getValueAsync(key, null, user);
                    let expected: any = Helper.GetTypedValue(line.split(";")[i], key);

                    if (actual !== expected) {

                        let l = `Matrix test failed in line ${lineIndex + 1}.\n User: ${JSON.stringify(user)},\n Key: ${key},\n Actual: ${actual}, Expected: ${expected}`;
                        console.log(l);
                    }

                    assert.strictEqual(actual, expected);
                }
            }
        }
    }
});