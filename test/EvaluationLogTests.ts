import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import "mocha";
import { User } from "../src";
import { LogLevel, LoggerWrapper } from "../src/ConfigCatLogger";
import { SettingValue, WellKnownUserObjectAttribute } from "../src/ProjectConfig";
import { RolloutEvaluator, evaluate } from "../src/RolloutEvaluator";
import { errorToString } from "../src/Utils";
import { CdnConfigLocation, ConfigLocation, LocalFileConfigLocation } from "./helpers/ConfigLocation";
import { FakeLogger } from "./helpers/fakes";
import { normalizeLineEndings } from "./helpers/utils";

const testDataBasePath = path.join("test", "data", "evaluationlog");

type TestSet = {
  sdkKey: string;
  baseUrl?: string;
  jsonOverride?: string;
  tests?: ReadonlyArray<TestCase>;
}

type TestCase = {
  key: string;
  defaultValue: SettingValue;
  returnValue: NonNullable<SettingValue>;
  expectedLog: string;
  user?: Readonly<{ [key: string]: string }>;
}

describe("Evaluation log", () => {
  describeTestSet("simple_value");
  describeTestSet("1_targeting_rule");
  describeTestSet("2_targeting_rules");
  describeTestSet("options_based_on_user_id");
  describeTestSet("options_based_on_custom_attr");
  describeTestSet("options_after_targeting_rule");
  describeTestSet("options_within_targeting_rule");
  describeTestSet("and_rules");
  describeTestSet("segment");
  describeTestSet("prerequisite_flag");
  describeTestSet("comparators");
  describeTestSet("circular_dependency");
  describeTestSet("epoch_date_validation");
  describeTestSet("number_validation");
  describeTestSet("semver_validation");
  describeTestSet("list_truncation");
});

function describeTestSet(testSetName: string) {
  for (const [configLocation, testCase] of getTestCases(testSetName)) {
    const userJson = JSON.stringify(testCase.user ?? null).replace(/"/g, "'");
    it(`${testSetName} - ${configLocation} | ${testCase.key} | ${testCase.defaultValue} | ${userJson}`, () => runTest(testSetName, configLocation, testCase));
  }
}

function* getTestCases(testSetName: string): Generator<[ConfigLocation, TestCase], void, undefined> {
  const data = fs.readFileSync(path.join(testDataBasePath, testSetName + ".json"), "utf8");
  const testSet: TestSet = JSON.parse(data);

  const configLocation = testSet.sdkKey
    ? new CdnConfigLocation(testSet.sdkKey, testSet.baseUrl)
    : new LocalFileConfigLocation(testDataBasePath, "_overrides", testSet.jsonOverride!);

  for (const testCase of testSet.tests ?? []) {
    yield [configLocation, testCase];
  }
}

function createUser(userRaw?: Readonly<{ [key: string]: string }>): User | undefined {
  if (!userRaw) {
    return;
  }

  const identifierAttribute: WellKnownUserObjectAttribute = "Identifier";
  const emailAttribute: WellKnownUserObjectAttribute = "Email";
  const countryAttribute: WellKnownUserObjectAttribute = "Country";

  const user = new User(userRaw[identifierAttribute]);

  const email = userRaw[emailAttribute];
  if (email) {
    user.email = email;
  }

  const country = userRaw[countryAttribute];
  if (country) {
    user.country = country;
  }

  const wellKnownAttributes: string[] = [identifierAttribute, emailAttribute, countryAttribute];
  for (const attributeName of Object.keys(userRaw)) {
    if (wellKnownAttributes.indexOf(attributeName) < 0) {
      user.custom[attributeName] = userRaw[attributeName];
    }
  }

  return user;
}

function formatLogEvent(event: FakeLogger["events"][0]) {
  const [level, eventId, message, exception] = event;

  const levelString =
    level === LogLevel.Debug ? "DEBUG" :
    level === LogLevel.Info ? "INFO" :
    level === LogLevel.Warn ? "WARNING" :
    level === LogLevel.Error ? "ERROR" :
    LogLevel[level].toUpperCase().padStart(5);

  const exceptionString = exception !== void 0 ? "\n" + errorToString(exception, true) : "";

  return `${levelString} [${eventId}] ${message}${exceptionString}`;
}

async function runTest(testSetName: string, configLocation: ConfigLocation, testCase: TestCase) {
  const config = await configLocation.fetchConfigCachedAsync();

  const fakeLogger = new FakeLogger();
  const logger = new LoggerWrapper(fakeLogger);
  const evaluator = new RolloutEvaluator(logger);

  const user = createUser(testCase.user);
  const evaluationDetails = evaluate(evaluator, config.settings, testCase.key, testCase.defaultValue, user, null, logger);
  const actualReturnValue = evaluationDetails.value;

  assert.strictEqual(actualReturnValue, testCase.returnValue);

  const expectedLogFilePath = path.join(testDataBasePath, testSetName, testCase.expectedLog);
  const expectedLogText = normalizeLineEndings(await util.promisify(fs.readFile)(expectedLogFilePath, "utf8")).replace(/(\r|\n)*$/, "");
  const actualLogText = fakeLogger.events.map(e => formatLogEvent(e)).join("\n");

  assert.strictEqual(actualLogText, expectedLogText);
}
