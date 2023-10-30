import { assert } from "chai";
import * as fs from "fs";
import "mocha";
import { LogLevel, SettingValue, User } from "../src";
import { createConsoleLogger } from "../src";
import { LoggerWrapper } from "../src/ConfigCatLogger";
import { RolloutEvaluator, evaluate, getUserAttributes } from "../src/RolloutEvaluator";
import { CdnConfigLocation, ConfigLocation } from "./helpers/ConfigLocation";

type MatrixTestCase = [key: string, user: User | undefined, userAttributesJson: string, expected: string];

describe("MatrixTests", () => {
  const logger = new LoggerWrapper(createConsoleLogger(LogLevel.Error));
  const evaluator = new RolloutEvaluator(logger);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d62463-86ec-8fde-f5b5-1c5c426fc830/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Basic operators", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/psuH7BGHoUmdONrzzUOY7A"), "test/data/testmatrix.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d747f0-5986-c2ef-eef3-ec778e32e10a/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Numeric operators", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/uGyK3q9_ckmdxRyI7vjwCw"), "test/data/testmatrix_number.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d745f1-f315-7daf-d163-5541d3786e6f/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("SemVer operators", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/BAr3KgLTP0ObzKnBTo5nhA"), "test/data/testmatrix_semantic.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d77fa1-a796-85f9-df0c-57c448eb9934/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("SemVer operators 2", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/q6jMCFIp-EmuAfnmZhPY7w"), "test/data/testmatrix_semantic_2.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d7b724-9285-f4a7-9fcd-00f64f1e83d5/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Sensitive text operators", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/qX3TP2dTj06ZpCCT1h_SPA"), "test/data/testmatrix_sensitive.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d774b9-3d05-0027-d5f4-3e76c3dba752/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Variation ID", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/nQ5qkhRAUEa6beEyyrVLBA"), "test/data/testmatrix_variationid.csv", evaluator, runVariationIdMatrixTest);
});

function describeMatrixTest(title: string, configLocation: ConfigLocation, matrixFilePath: string, evaluator: RolloutEvaluator,
  runner: (configLocation: ConfigLocation, key: string, user: User | undefined, expected: string, evaluator: RolloutEvaluator) => void = runMatrixTest) {

  for (const [key, user, userAttributesJson, expected] of getMatrixTestCases(matrixFilePath)) {
    it(`${title} - ${configLocation} | ${key} | ${userAttributesJson}`, () => runner(configLocation, key, user, expected, evaluator));
  }
}

function* getMatrixTestCases(matrixFilePath: string): Generator<MatrixTestCase> {
  const data = fs.readFileSync(matrixFilePath, "utf8");

  const lines: string[] = data.toString().split(/\r\n?|\n/);
  const header: string[] = lines.shift()?.split(";") ?? [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line.trim()) {
      continue;
    }
    const columns = line.split(";");

    const user = createUser(columns, header);
    const userAttributesJson = JSON.stringify(user ? getUserAttributes(user) : null);

    for (let i = 4; i < header.length; i++) {
      const key = header[i];
      const expected = columns[i];
      yield [key, user, userAttributesJson, expected];
    }
  }
}

function createUser(columns: ReadonlyArray<string>, headers: string[]): User | undefined {
  const USERNULL = "##null##";

  if (columns[0] === USERNULL) {
    return;
  }

  const result: User = new User(columns[0]);

  if (columns[1] !== USERNULL) {
    result.email = columns[1];
  }

  if (columns[2] !== USERNULL) {
    result.country = columns[2];
  }

  if (columns[3] !== USERNULL) {
    result.custom = result.custom || {};
    result.custom[headers[3]] = columns[3];
  }

  return result;
}

function getTypedValue(value: string, header: string): NonNullable<SettingValue> {
  if (header.startsWith("bool")) {
    return value.toLowerCase() === "true";
  }

  if (header.startsWith("integer") || header.startsWith("double")) {
    return +value;
  }

  return value;
}

async function runMatrixTest(configLocation: ConfigLocation, key: string, user: User | undefined, expected: string, evaluator: RolloutEvaluator) {
  const config = await configLocation.fetchConfigCachedAsync();

  const actual = evaluate(evaluator, config.settings, key, null, user, null, evaluator["logger"]).value;
  assert.strictEqual(actual, getTypedValue(expected, key));
}

async function runVariationIdMatrixTest(configLocation: ConfigLocation, key: string, user: User | undefined, expected: string, evaluator: RolloutEvaluator) {
  const config = await configLocation.fetchConfigCachedAsync();

  const actual = evaluate(evaluator, config.settings, key, null, user, null, evaluator["logger"]).variationId;
  assert.strictEqual(actual, expected);
}
