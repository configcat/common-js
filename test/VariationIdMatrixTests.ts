import { assert } from "chai";
import * as fs from "fs";
import "mocha";
import { ConfigCatClient, IConfigCatClient } from "../src/ConfigCatClient";
import { AutoPollOptions } from "../src/ConfigCatClientOptions";
import { User } from "../src/RolloutEvaluator";
import { FakeConfigCatKernel, FakeConfigFetcherBase } from "./helpers/fakes";

describe("MatrixTests", () => {

  const variationid_v5: string = fs.readFileSync("test/data/sample_variationid_v5.json", "utf8");

  it("GetVariationId", async () => {

    let configCatKernel: FakeConfigCatKernel = {
      configFetcher: new FakeConfigFetcherBase(variationid_v5),
      sdkType: "common",
      sdkVersion: "1.0.0"
    };
    let options: AutoPollOptions = new AutoPollOptions("APIKEY", "common", "1.0.0", { logger: null }, null);
    let client: IConfigCatClient = new ConfigCatClient(options, configCatKernel);

    let header: string[] | null = null;
    let rowNo: number = 1;

    const data = fs.readFileSync("test/data/testmatrix_variationId.csv", "utf8");

    var lines: string[] = data.toString().split(require("os").EOL);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      let line = lines[lineIndex];

      if (header) {

        if (!line) {
          return;
        }

        let user = Helper.CreateUser(line, header);
        let splittedLine = line.split(";");
        for (let i: number = 4; i < header.length; i++) {

          const key: string = header[i];
          const expected = splittedLine[i];
          const actual = await client.getVariationIdAsync(key, null, user);

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
    }
  });

  class Helper {

    public static CreateUser(row: string, headers: string[]): User | undefined {

      let up: string[] = row.split(";");

      if (up[0] === "##null##") {
        return undefined;
      }

      let result: User = new User(up[0]);

      if (up[1] !== "##null##") {
        result.email = up[1];
      }

      if (up[2] !== "##null##") {
        result.country = up[2];
      }

      if (up[3] !== "##null##") {
        result.custom = result.custom || {};
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
  }
});
