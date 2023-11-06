import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import "mocha";
import { LogLevel, SettingType, SettingValue, User } from "../src";
import { createConsoleLogger } from "../src";
import { LoggerWrapper } from "../src/ConfigCatLogger";
import { RolloutEvaluator, evaluate } from "../src/RolloutEvaluator";
import { getUserAttributes } from "../src/User";
import { CdnConfigLocation, ConfigLocation } from "./helpers/ConfigLocation";

const testDataBasePath = path.join("test", "data");

type MatrixTestCase = [key: string, user: User | undefined, userAttributesJson: string, expected: string];

const logger = new LoggerWrapper(createConsoleLogger(LogLevel.Error));
const evaluator = new RolloutEvaluator(logger);

describe("MatrixTests (config v1)", () => {
  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d62463-86ec-8fde-f5b5-1c5c426fc830/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Basic operators", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/psuH7BGHoUmdONrzzUOY7A"), "testmatrix.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d747f0-5986-c2ef-eef3-ec778e32e10a/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Numeric operators", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/uGyK3q9_ckmdxRyI7vjwCw"), "testmatrix_number.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d9f207-6883-43e5-868c-cbf677af3fe6/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Segments v1", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/LcYz135LE0qbcacz2mgXnA"), "testmatrix_segments_old.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d745f1-f315-7daf-d163-5541d3786e6f/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("SemVer operators", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/BAr3KgLTP0ObzKnBTo5nhA"), "testmatrix_semantic.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d77fa1-a796-85f9-df0c-57c448eb9934/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("SemVer operators 2", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/q6jMCFIp-EmuAfnmZhPY7w"), "testmatrix_semantic_2.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d7b724-9285-f4a7-9fcd-00f64f1e83d5/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Sensitive text operators", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/qX3TP2dTj06ZpCCT1h_SPA"), "testmatrix_sensitive.csv", evaluator);

  // https://app.configcat.com/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08d774b9-3d05-0027-d5f4-3e76c3dba752/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Variation ID", new CdnConfigLocation("PKDVCLf-Hq-h-kCzMp-L7Q/nQ5qkhRAUEa6beEyyrVLBA"), "testmatrix_variationid.csv", evaluator, runVariationIdMatrixTest);
});

describe("MatrixTests (config v2)", () => {
  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08dbc4dc-1927-4d6b-8fb9-b1472564e2d3/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Basic operators", new CdnConfigLocation("configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/AG6C1ngVb0CvM07un6JisQ"), "testmatrix.csv", evaluator);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08dbc4dc-0fa3-48d0-8de8-9de55b67fb8b/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Numeric operators", new CdnConfigLocation("configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw"), "testmatrix_number.csv", evaluator);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08dbd6ca-a85f-4ed0-888a-2da18def92b5/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Segments v1", new CdnConfigLocation("configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/y_ZB7o-Xb0Swxth-ZlMSeA"), "testmatrix_segments_old.csv", evaluator);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08dbc4dc-278c-4f83-8d36-db73ad6e2a3a/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("SemVer operators", new CdnConfigLocation("configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/iV8vH2MBakKxkFZylxHmTg"), "testmatrix_semantic.csv", evaluator);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08dbc4dc-2b2b-451e-8359-abdef494c2a2/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("SemVer operators 2", new CdnConfigLocation("configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/U8nt3zEhDEO5S2ulubCopA"), "testmatrix_semantic_2.csv", evaluator);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08dbc4dc-2d62-4e1b-884b-6aa237b34764/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Sensitive text operators", new CdnConfigLocation("configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/-0YmVOUNgEGKkgRF-rU65g"), "testmatrix_sensitive.csv", evaluator);

  //https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08d5a03c-feb7-af1e-a1fa-40b3329f8bed/08dbc4dc-30c6-4969-8e4c-03f6a8764199/244cf8b0-f604-11e8-b543-f23c917f9d8d
  describeMatrixTest("Variation ID", new CdnConfigLocation("configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/spQnkRTIPEWVivZkWM84lQ"), "testmatrix_variationid.csv", evaluator, runVariationIdMatrixTest);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08dbc325-7f69-4fd4-8af4-cf9f24ec8ac9/08dbc325-9d5e-4988-891c-fd4a45790bd1/08dbc325-9ebd-4587-8171-88f76a3004cb
  describeMatrixTest("AND conditions", new CdnConfigLocation("configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/ByMO9yZNn02kXcm72lnY1A"), "testmatrix_and_or.csv", evaluator);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08dbc325-7f69-4fd4-8af4-cf9f24ec8ac9/08dbc325-9a6b-4947-84e2-91529248278a/08dbc325-9ebd-4587-8171-88f76a3004cb
  describeMatrixTest("Comparators v2", new CdnConfigLocation("configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ"), "testmatrix_comparators_v6.csv", evaluator);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08dbc325-7f69-4fd4-8af4-cf9f24ec8ac9/08dbc325-9b74-45cb-86d0-4d61c25af1aa/08dbc325-9ebd-4587-8171-88f76a3004cb
  describeMatrixTest("Prerequisite flags", new CdnConfigLocation("configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/JoGwdqJZQ0K2xDy7LnbyOg"), "testmatrix_prerequisite_flag.csv", evaluator);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08dbc325-7f69-4fd4-8af4-cf9f24ec8ac9/08dbc325-9cfb-486f-8906-72a57c693615/08dbc325-9ebd-4587-8171-88f76a3004cb
  describeMatrixTest("Segments v2", new CdnConfigLocation("configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/h99HYXWWNE2bH8eWyLAVMA"), "testmatrix_segments.csv", evaluator);

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08dbc325-7f69-4fd4-8af4-cf9f24ec8ac9/08dbd63c-9774-49d6-8187-5f2aab7bd606/08dbc325-9ebd-4587-8171-88f76a3004cb
  describeMatrixTest("Unicode texts", new CdnConfigLocation("configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/Da6w8dBbmUeMUBhh0iEeQQ"), "testmatrix_unicode.csv", evaluator);
});

function describeMatrixTest(title: string, configLocation: ConfigLocation, matrixFilePath: string, evaluator: RolloutEvaluator,
  runner: (configLocation: ConfigLocation, key: string, user: User | undefined, expected: string, evaluator: RolloutEvaluator) => void = runMatrixTest) {

  for (const [key, user, userAttributesJson, expected] of getMatrixTestCases(matrixFilePath)) {
    it(`${title} - ${configLocation} | ${key} | ${userAttributesJson}`, () => runner(configLocation, key, user, expected, evaluator));
  }
}

function* getMatrixTestCases(matrixFilePath: string): Generator<MatrixTestCase> {
  const data = fs.readFileSync(path.join(testDataBasePath, matrixFilePath), "utf8");

  const lines: string[] = data.toString().split(/\r\n?|\n/);
  const header: string[] = lines.shift()?.split(";") ?? [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line.trim()) {
      continue;
    }
    const columns = line.split(";");

    const user = createUser(columns, header);
    const userAttributesJson = JSON.stringify(user ? getUserAttributes(user) : null).replace(/"/g, "'");

    for (let i = 4; i < header.length; i++) {
      const key = header[i];
      const expected = columns[i];
      yield [key, user, userAttributesJson, expected];
    }
  }
}

function createUser(columns: ReadonlyArray<string>, headers: string[]): User | undefined {
  const USERNULL = "##null##";

  const [identifier, email, country, custom] = columns;

  if (identifier === USERNULL) {
    return;
  }

  const result: User = new User(identifier);

  if (email && email !== USERNULL) {
    result.email = email;
  }

  if (country && country !== USERNULL) {
    result.country = country;
  }

  if (custom && custom !== USERNULL) {
    result.custom[headers[3]] = custom;
  }

  return result;
}

function getTypedValue(value: string, settingType: SettingType): NonNullable<SettingValue> {
  switch (settingType) {
    case SettingType.Boolean: return value.toLowerCase() === "true";
    case SettingType.Int:
    case SettingType.Double: return +value;
    default: return value;
  }
}

async function runMatrixTest(configLocation: ConfigLocation, key: string, user: User | undefined, expected: string, evaluator: RolloutEvaluator) {
  const config = await configLocation.fetchConfigCachedAsync();
  const setting = config.settings[key];

  const actual = evaluate(evaluator, config.settings, key, null, user, null, evaluator["logger"]).value;
  assert.strictEqual(actual, getTypedValue(expected, setting.type));
}

async function runVariationIdMatrixTest(configLocation: ConfigLocation, key: string, user: User | undefined, expected: string, evaluator: RolloutEvaluator) {
  const config = await configLocation.fetchConfigCachedAsync();

  const actual = evaluate(evaluator, config.settings, key, null, user, null, evaluator["logger"]).variationId;
  assert.strictEqual(actual, expected);
}
