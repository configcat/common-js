import { assert } from "chai";
import "mocha";
import { FlagOverrides, IManualPollOptions, MapOverrideDataSource, OverrideBehaviour, SettingValue, User } from "../src";
import { LogLevel, LoggerWrapper } from "../src/ConfigCatLogger";
import { RolloutEvaluator, evaluate, isAllowedValue } from "../src/RolloutEvaluator";
import { errorToString } from "../src/Utils";
import { CdnConfigLocation, LocalFileConfigLocation } from "./helpers/ConfigLocation";
import { FakeLogger } from "./helpers/fakes";
import { HttpConfigFetcher } from "./helpers/HttpConfigFetcher";
import { createClientWithManualPoll, sdkType, sdkVersion } from "./helpers/utils";

describe("Setting evaluation (config v2)", () => {

  for (const [key, dependencyCycle] of <[string, string][]>[
    ["key1", "'key1' -> 'key1'"],
    ["key2", "'key2' -> 'key3' -> 'key2'"],
    ["key4", "'key4' -> 'key3' -> 'key2' -> 'key3'"],
  ]) {
    it("Prerequisite flag circular dependency detection", async () => {
      const configLocation = new LocalFileConfigLocation("test", "data", "test_circulardependency_v6.json");
      const config = await configLocation.fetchConfigAsync();

      const fakeLogger = new FakeLogger();
      const logger = new LoggerWrapper(fakeLogger);
      const evaluator = new RolloutEvaluator(logger);

      try {
        evaluate(evaluator, config.settings, key, null, void 0, null, logger);
        assert.fail("evaluate should throw.")
      }
      catch (err) {
        const errMsg = errorToString(err);
        assert.include(errMsg, "Circular dependency detected");
        assert.include(errMsg, dependencyCycle);
      }
    });
  }

  for (const [key, prerequisiteFlagKey, prerequisiteFlagValue, expectedValue] of <[string, string, unknown, string | null][]>[
    ["stringDependsOnBool", "mainBoolFlag", true, "Dog"],
    ["stringDependsOnBool", "mainBoolFlag", false, "Cat"],
    ["stringDependsOnBool", "mainBoolFlag", "1", null],
    ["stringDependsOnBool", "mainBoolFlag", 1, null],
    ["stringDependsOnBool", "mainBoolFlag", [true], null],
    ["stringDependsOnBool", "mainBoolFlag", null, null],
    ["stringDependsOnBool", "mainBoolFlag", void 0, null],
    ["stringDependsOnString", "mainStringFlag", "private", "Dog"],
    ["stringDependsOnString", "mainStringFlag", "Private", "Cat"],
    ["stringDependsOnString", "mainStringFlag", true, null],
    ["stringDependsOnString", "mainStringFlag", 1, null],
    ["stringDependsOnString", "mainStringFlag", ["private"], null],
    ["stringDependsOnString", "mainStringFlag", null, null],
    ["stringDependsOnString", "mainStringFlag", void 0, null],
    ["stringDependsOnInt", "mainIntFlag", 2, "Dog"],
    ["stringDependsOnInt", "mainIntFlag", 1, "Cat"],
    ["stringDependsOnInt", "mainIntFlag", "2", null],
    ["stringDependsOnInt", "mainIntFlag", true, null],
    ["stringDependsOnInt", "mainIntFlag", [2], null],
    ["stringDependsOnInt", "mainIntFlag", null, null],
    ["stringDependsOnInt", "mainIntFlag", void 0, null],
    ["stringDependsOnDouble", "mainDoubleFlag", 0.1, "Dog"],
    ["stringDependsOnDouble", "mainDoubleFlag", 0.11, "Cat"],
    ["stringDependsOnDouble", "mainDoubleFlag", "0.1", null],
    ["stringDependsOnDouble", "mainDoubleFlag", true, null],
    ["stringDependsOnDouble", "mainDoubleFlag", [0.1], null],
    ["stringDependsOnDouble", "mainDoubleFlag", null, null],
    ["stringDependsOnDouble", "mainDoubleFlag", void 0, null],
  ]) {
    it(`Prerequisite flag comparison value type mismatch - key: ${key} | prerequisiteFlagKey: ${prerequisiteFlagKey} | prerequisiteFlagValue: ${prerequisiteFlagValue}`, async () => {
      const overrideMap: { [name: string]: NonNullable<SettingValue> } = {
        [prerequisiteFlagKey]: prerequisiteFlagValue as unknown as NonNullable<SettingValue>
      };

      const fakeLogger = new FakeLogger();
      const options: IManualPollOptions = {
        flagOverrides: new FlagOverrides(new MapOverrideDataSource(overrideMap), OverrideBehaviour.LocalOverRemote),
        logger: fakeLogger
      };

      // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08dbc325-7f69-4fd4-8af4-cf9f24ec8ac9/08dbc325-9b74-45cb-86d0-4d61c25af1aa/08dbc325-9ebd-4587-8171-88f76a3004cb
      const client = createClientWithManualPoll("configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/JoGwdqJZQ0K2xDy7LnbyOg",
        { sdkType, sdkVersion, configFetcher: new HttpConfigFetcher() }, options);

      try {
        await client.forceRefreshAsync();
        const actualValue = await client.getValueAsync(key, null);

        assert.strictEqual(expectedValue, actualValue);

        if (actualValue == null) {
          const errors = fakeLogger.events.filter(([level]) => level === LogLevel.Error);
          assert.strictEqual(1, errors.length);
          const [, eventId, , err] = errors[0];
          assert.strictEqual(1002, eventId);

          const errMsg = errorToString(err);
          if (prerequisiteFlagValue === null) {
            assert.include(errMsg, "Setting value is null");
          }
          else if (prerequisiteFlagValue === void 0) {
            assert.include(errMsg, "Setting value is undefined");
          }
          else if (!isAllowedValue(prerequisiteFlagValue)) {
            assert.match(errMsg, /Setting value '[^']+' is of an unsupported type/);
          }
          else {
            assert.match(errMsg, /Type mismatch between comparison value '[^']+' and prerequisite flag '[^']+'/);
          }
        }
      }
      finally {
        client.dispose();
      }
    });
  }

  for (const [key, userId, email, overrideBehaviour, expectedValue] of <[string, string, string, OverrideBehaviour, string][]>[
    ["stringDependsOnString", "1", "john@sensitivecompany.com", null, "Dog"],
    ["stringDependsOnString", "1", "john@sensitivecompany.com", OverrideBehaviour.RemoteOverLocal, "Dog"],
    ["stringDependsOnString", "1", "john@sensitivecompany.com", OverrideBehaviour.LocalOverRemote, "Dog"],
    ["stringDependsOnString", "1", "john@sensitivecompany.com", OverrideBehaviour.LocalOnly, null],
    ["stringDependsOnString", "2", "john@notsensitivecompany.com", null, "Cat"],
    ["stringDependsOnString", "2", "john@notsensitivecompany.com", OverrideBehaviour.RemoteOverLocal, "Cat"],
    ["stringDependsOnString", "2", "john@notsensitivecompany.com", OverrideBehaviour.LocalOverRemote, "Dog"],
    ["stringDependsOnString", "2", "john@notsensitivecompany.com", OverrideBehaviour.LocalOnly, null],
    ["stringDependsOnInt", "1", "john@sensitivecompany.com", null, "Dog"],
    ["stringDependsOnInt", "1", "john@sensitivecompany.com", OverrideBehaviour.RemoteOverLocal, "Dog"],
    ["stringDependsOnInt", "1", "john@sensitivecompany.com", OverrideBehaviour.LocalOverRemote, "Falcon"],
    ["stringDependsOnInt", "1", "john@sensitivecompany.com", OverrideBehaviour.LocalOnly, "Falcon"],
    ["stringDependsOnInt", "2", "john@notsensitivecompany.com", null, "Cat"],
    ["stringDependsOnInt", "2", "john@notsensitivecompany.com", OverrideBehaviour.RemoteOverLocal, "Cat"],
    ["stringDependsOnInt", "2", "john@notsensitivecompany.com", OverrideBehaviour.LocalOverRemote, "Falcon"],
    ["stringDependsOnInt", "2", "john@notsensitivecompany.com", OverrideBehaviour.LocalOnly, "Falcon"],
  ]) {
    it(`Prerequisite flag override - key: ${key} | userId: ${userId} | email: ${email} | overrideBehavior: ${overrideBehaviour}`, async () => {
      const overrideMap: { [name: string]: NonNullable<SettingValue> } = {
        ["mainStringFlag"]: "private", // to check the case where a prerequisite flag is overridden (dependent flag: 'stringDependsOnString')
        ["stringDependsOnInt"]: "Falcon" // to check the case where a dependent flag is overridden (prerequisite flag: 'mainIntFlag')
      };

      const options: IManualPollOptions = {
        flagOverrides: new FlagOverrides(new MapOverrideDataSource(overrideMap), overrideBehaviour)
      };

      // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08dbc325-7f69-4fd4-8af4-cf9f24ec8ac9/08dbc325-9b74-45cb-86d0-4d61c25af1aa/08dbc325-9ebd-4587-8171-88f76a3004cb
      const client = createClientWithManualPoll("configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/JoGwdqJZQ0K2xDy7LnbyOg",
        { sdkType, sdkVersion, configFetcher: new HttpConfigFetcher() }, options);

      try {
        await client.forceRefreshAsync();
        const actualValue = await client.getValueAsync(key, null, new User(userId, email));

        assert.strictEqual(expectedValue, actualValue);
      }
      finally {
        client.dispose();
      }
    });
  }

  // https://app.configcat.com/v2/e7a75611-4256-49a5-9320-ce158755e3ba/08dbc325-7f69-4fd4-8af4-cf9f24ec8ac9/08dbc325-9e4e-4f59-86b2-5da50924b6ca/08dbc325-9ebd-4587-8171-88f76a3004cb
  for (const [sdkKey, key, userId, email, percentageBase, expectedReturnValue, expectedIsExpectedMatchedTargetingRuleSet, expectedIsExpectedMatchedPercentageOptionSet] of
    <[string, string, string | null, string | null, string | null, string, boolean, boolean][]>[
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/P4e3fAz_1ky2-Zg2e4cbkw", "stringMatchedTargetingRuleAndOrPercentageOption", null, null, null, "Cat", false, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/P4e3fAz_1ky2-Zg2e4cbkw", "stringMatchedTargetingRuleAndOrPercentageOption", "12345", null, null, "Cat", false, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/P4e3fAz_1ky2-Zg2e4cbkw", "stringMatchedTargetingRuleAndOrPercentageOption", "12345", "a@example.com", null, "Dog", true, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/P4e3fAz_1ky2-Zg2e4cbkw", "stringMatchedTargetingRuleAndOrPercentageOption", "12345", "a@configcat.com", null, "Cat", false, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/P4e3fAz_1ky2-Zg2e4cbkw", "stringMatchedTargetingRuleAndOrPercentageOption", "12345", "a@configcat.com", "", "Frog", true, true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/P4e3fAz_1ky2-Zg2e4cbkw", "stringMatchedTargetingRuleAndOrPercentageOption", "12345", "a@configcat.com", "US", "Fish", true, true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/P4e3fAz_1ky2-Zg2e4cbkw", "stringMatchedTargetingRuleAndOrPercentageOption", "12345", "b@configcat.com", null, "Cat", false, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/P4e3fAz_1ky2-Zg2e4cbkw", "stringMatchedTargetingRuleAndOrPercentageOption", "12345", "b@configcat.com", "", "Falcon", false, true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/P4e3fAz_1ky2-Zg2e4cbkw", "stringMatchedTargetingRuleAndOrPercentageOption", "12345", "b@configcat.com", "US", "Spider", false, true],
    ]) {
    it(`IEvaluationDetails.matchedTargetingRule/matchedTargetingOption - sdkKey: ${sdkKey} | key: ${key} | userId: ${userId} | email: ${email} | percentageBase: ${percentageBase} `, async () => {
      const configLocation = new CdnConfigLocation(sdkKey);
      const config = await configLocation.fetchConfigAsync();

      const fakeLogger = new FakeLogger();
      const logger = new LoggerWrapper(fakeLogger);
      const evaluator = new RolloutEvaluator(logger);

      const user = userId != null ? new User(userId, email!, void 0, { ["PercentageBase"]: percentageBase! }) : null;

      const evaluationDetails = evaluate(evaluator, config.settings, key, null, user!, null, logger);

      assert.strictEqual(evaluationDetails.value, expectedReturnValue);
      assert.strictEqual(evaluationDetails.matchedTargetingRule !== void 0, expectedIsExpectedMatchedTargetingRuleSet);
      assert.strictEqual(evaluationDetails.matchedPercentageOption !== void 0, expectedIsExpectedMatchedPercentageOptionSet);
    });
  }
});
