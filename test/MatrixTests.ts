import { assert } from "chai";
import * as fs from "fs";
import "mocha";
import { EOL } from "os";
import { createClientWithManualPoll } from "../src";
import { ConfigCatConsoleLogger, LogLevel } from "../src/ConfigCatLogger";
import { User } from "../src/RolloutEvaluator";
import { FakeConfigCatKernel, FakeConfigFetcherBase } from "./helpers/fakes";

describe("MatrixTests", () => {

  it("GetValue basic operators", async () => {
    await Helper.RunMatrixTest("test/data/sample_v5.json", "test/data/testmatrix.csv");
  });

  it("GetValue numeric operators", async () => {
    await Helper.RunMatrixTest("test/data/sample_number_v5.json", "test/data/testmatrix_number.csv");
  });

  it("GetValue semver operators", async () => {
    await Helper.RunMatrixTest("test/data/sample_semantic_v5.json", "test/data/testmatrix_semantic.csv");
  });

  it("GetValue semver operators", async () => {
    await Helper.RunMatrixTest("test/data/sample_semantic_2_v5.json", "test/data/testmatrix_semantic_2.csv");
  });

  it("GetValue sensitive operators", async () => {
    await Helper.RunMatrixTest("test/data/sample_sensitive_v5.json", "test/data/testmatrix_sensitive.csv");
  });

  class Helper {

    public static CreateUser(row: string, headers: string[]): User | undefined {

      const column: string[] = row.split(";");
      const USERNULL = "##null##";

      if (column[0] === USERNULL) {
        return;
      }

      const result: User = new User(column[0]);

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
      const configCatKernel: FakeConfigCatKernel = { configFetcher: new FakeConfigFetcherBase(SAMPLE), sdkType: "common", sdkVersion: "1.0.0" };
      const client = createClientWithManualPoll("SDKKEY", configCatKernel, {
        logger: new ConfigCatConsoleLogger(LogLevel.Off)
      });

      await client.forceRefreshAsync();

      const data = fs.readFileSync(matrixFilePath, "utf8");

      const lines: string[] = data.toString().split(EOL);
      const header: string[] = lines.shift()?.split(";") ?? [];

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        if (!line) {
          return;
        }

        const user = Helper.CreateUser(line, header);

        for (let i = 4; i < header.length; i++) {

          const key: string = header[i];
          const actual: any = await client.getValueAsync(key, null, user);
          const expected: any = Helper.GetTypedValue(line.split(";")[i], key);

          if (actual !== expected) {

            const l = `Matrix test failed in line ${lineIndex + 1}.\n User: ${JSON.stringify(user)},\n Key: ${key},\n Actual: ${actual}, Expected: ${expected}`;
            console.log(l);
          }

          assert.strictEqual(actual, expected);
        }
      }
    }
  }
});
