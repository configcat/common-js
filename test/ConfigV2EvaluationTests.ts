import { assert } from "chai";
import "mocha";
import { IManualPollOptions, OverrideBehaviour, SettingValue, User, UserAttributeValue } from "../src";
import { LogLevel, LoggerWrapper } from "../src/ConfigCatLogger";
import { FlagOverrides, MapOverrideDataSource } from "../src/FlagOverrides";
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
        assert.fail("evaluate should throw.");
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
    it(`IEvaluationDetails.matchedTargetingRule/matchedTargetingOption - sdkKey: ${sdkKey} | key: ${key} | userId: ${userId} | email: ${email} | percentageBase: ${percentageBase}`, async () => {
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

  it("User Object attribute conversions - text comparisons", async () => {
    const configLocation = new CdnConfigLocation("configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ");
    const config = await configLocation.fetchConfigCachedAsync();

    const fakeLogger = new FakeLogger();
    const logger = new LoggerWrapper(fakeLogger);
    const evaluator = new RolloutEvaluator(logger);

    const customAttributeName = "Custom1", customAttributeValue = 42;
    const user = new User("12345", void 0, void 0, { [customAttributeName]: customAttributeValue });

    const key = "boolTextEqualsNumber";
    const evaluationDetails = evaluate(evaluator, config.settings, key, null, user!, null, logger);

    assert.strictEqual(evaluationDetails.value, true);

    const warnings = fakeLogger.events.filter(([level]) => level === LogLevel.Warn);
    assert.strictEqual(warnings.length, 1);

    const [, eventId, message] = warnings[0];
    assert.strictEqual(eventId, 3005);
    const expectedAttributeValueText = customAttributeValue + "";
    assert.strictEqual(message.toString(), `Evaluation of condition (User.${customAttributeName} EQUALS '${expectedAttributeValueText}') for setting '${key}' may not produce the expected result (the User.${customAttributeName} attribute is not a string value, thus it was automatically converted to the string value '${expectedAttributeValueText}'). Please make sure that using a non-string value was intended.`);
  });

  for (const [sdkKey, key, userId, customAttributeName, customAttributeValue, expectedReturnValue] of
    <[string, string, string, string, UserAttributeValue, string][]>[
      // SemVer-based comparisons
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/iV8vH2MBakKxkFZylxHmTg", "lessThanWithPercentage", "12345", "Custom1", "0.0", "20%"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/iV8vH2MBakKxkFZylxHmTg", "lessThanWithPercentage", "12345", "Custom1", "0.9.9", "< 1.0.0"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/iV8vH2MBakKxkFZylxHmTg", "lessThanWithPercentage", "12345", "Custom1", "1.0.0", "20%"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/iV8vH2MBakKxkFZylxHmTg", "lessThanWithPercentage", "12345", "Custom1", "1.1", "20%"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/iV8vH2MBakKxkFZylxHmTg", "lessThanWithPercentage", "12345", "Custom1", 0, "20%"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/iV8vH2MBakKxkFZylxHmTg", "lessThanWithPercentage", "12345", "Custom1", 0.9, "20%"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/iV8vH2MBakKxkFZylxHmTg", "lessThanWithPercentage", "12345", "Custom1", 2, "20%"],
      // Number-based comparisons
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", -Infinity, "<2.1"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", -1, "<2.1"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", 2, "<2.1"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", 2.1, "<=2,1"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", 3, "<>4.2"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", 5, ">=5"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", Infinity, ">5"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", NaN, "<>4.2"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "-Infinity", "<2.1"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "-1", "<2.1"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "2", "<2.1"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "2.1", "<=2,1"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "2,1", "<=2,1"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "3", "<>4.2"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "5", ">=5"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "Infinity", ">5"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "NaN", "<>4.2"],
      ["configcat-sdk-1/PKDVCLf-Hq-h-kCzMp-L7Q/FCWN-k1dV0iBf8QZrDgjdw", "numberWithPercentage", "12345", "Custom1", "NaNa", "80%"],
      // Date time-based comparisons
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", new Date("2023-03-31T23:59:59.9990000Z"), false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", new Date("2023-04-01T01:59:59.9990000+02:00"), false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", new Date("2023-04-01T00:00:00.0010000Z"), true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", new Date("2023-04-01T02:00:00.0010000+02:00"), true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", new Date("2023-04-30T23:59:59.9990000Z"), true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", new Date("2023-05-01T01:59:59.9990000+02:00"), true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", new Date("2023-05-01T00:00:00.0010000Z"), false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", new Date("2023-05-01T02:00:00.0010000+02:00"), false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", -Infinity, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", 1680307199.999, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", 1680307200.001, true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", 1682899199.999, true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", 1682899200.001, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", Infinity, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", NaN, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", 1680307199, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", 1680307201, true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", 1682899199, true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", 1682899201, false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", "-Infinity", false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", "1680307199.999", false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", "1680307200.001", true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", "1682899199.999", true],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", "1682899200.001", false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", "+Infinity", false],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "boolTrueIn202304", "12345", "Custom1", "NaN", false],
      // String array-based comparisons
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "stringArrayContainsAnyOfDogDefaultCat", "12345", "Custom1", ["x", "read"], "Dog"],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "stringArrayContainsAnyOfDogDefaultCat", "12345", "Custom1", ["x", "Read"], "Cat"],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "stringArrayContainsAnyOfDogDefaultCat", "12345", "Custom1", "[\"x\", \"read\"]", "Dog"],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "stringArrayContainsAnyOfDogDefaultCat", "12345", "Custom1", "[\"x\", \"Read\"]", "Cat"],
      ["configcat-sdk-1/JcPbCGl_1E-K9M-fJOyKyQ/OfQqcTjfFUGBwMKqtyEOrQ", "stringArrayContainsAnyOfDogDefaultCat", "12345", "Custom1", "x, read", "Cat"],
    ]) {
    it(`User Object attribute conversions - non-text comparisons - sdkKey: ${sdkKey} | key: ${key} | userId: ${userId} | customAttributeName: ${customAttributeName} | customAttributeValue: ${customAttributeValue}`, async () => {
      const configLocation = new CdnConfigLocation(sdkKey);
      const config = await configLocation.fetchConfigCachedAsync();

      const fakeLogger = new FakeLogger();
      const logger = new LoggerWrapper(fakeLogger);
      const evaluator = new RolloutEvaluator(logger);

      const user = new User(userId, void 0, void 0, { [customAttributeName]: customAttributeValue });

      const evaluationDetails = evaluate(evaluator, config.settings, key, null, user!, null, logger);

      assert.strictEqual(evaluationDetails.value, expectedReturnValue);
    });
  }

  for (const [key, customAttributeValue, expectedReturnValue] of
    <[string, number | Date | ReadonlyArray<string>, string][]>[
      ["numberToStringConversion", .12345, "1"],
      ["numberToStringConversionInt", 125.0, "4"],
      ["numberToStringConversionPositiveExp", -1.23456789e96, "2"],
      ["numberToStringConversionNegativeExp", -12345.6789E-100, "4"],
      ["numberToStringConversionNaN", NaN, "3"],
      ["numberToStringConversionPositiveInf", Infinity, "4"],
      ["numberToStringConversionNegativeInf", -Infinity, "3"],
      ["dateToStringConversion", new Date("2023-03-31T23:59:59.9990000Z"), "3"],
      ["dateToStringConversion", 1680307199.999, "3"],
      ["dateToStringConversionNaN", NaN, "3"],
      ["dateToStringConversionPositiveInf", Infinity, "1"],
      ["dateToStringConversionNegativeInf", -Infinity, "5"],
      ["stringArrayToStringConversion", ["read", "Write", " eXecute "], "4"],
      ["stringArrayToStringConversionEmpty", [], "5"],
      ["stringArrayToStringConversionSpecialChars", ["+<>%\"'\\/\t\r\n"], "3"],
      ["stringArrayToStringConversionUnicode", ["äöüÄÖÜçéèñışğâ¢™✓😀"], "2"],
    ]) {
    it(`Comparison attribute conversion to canonical string representation - key: ${key} | customAttributeValue: ${customAttributeValue}`, async () => {
      const configLocation = new LocalFileConfigLocation("test", "data", "comparison_attribute_conversion.json");
      const config = await configLocation.fetchConfigAsync();

      const fakeLogger = new FakeLogger();
      const logger = new LoggerWrapper(fakeLogger);
      const evaluator = new RolloutEvaluator(logger);

      const user = new User("12345", void 0, void 0, {
        ["Custom1"]: customAttributeValue,
      });

      const evaluationDetails = evaluate(evaluator, config.settings, key, "default", user!, null, logger);

      assert.strictEqual(evaluationDetails.value, expectedReturnValue);
    });
  }

  for (const [key, expectedReturnValue] of
    <[string, string][]>[
      ["isoneof", "no trim"],
      ["isnotoneof", "no trim"],
      ["isoneofhashed", "no trim"],
      ["isnotoneofhashed", "no trim"],
      ["equalshashed", "no trim"],
      ["notequalshashed", "no trim"],
      ["arraycontainsanyofhashed", "no trim"],
      ["arraynotcontainsanyofhashed", "no trim"],
      ["equals", "no trim"],
      ["notequals", "no trim"],
      ["startwithanyof", "no trim"],
      ["notstartwithanyof", "no trim"],
      ["endswithanyof", "no trim"],
      ["notendswithanyof", "no trim"],
      ["arraycontainsanyof", "no trim"],
      ["arraynotcontainsanyof", "no trim"],
      ["startwithanyofhashed", "no trim"],
      ["notstartwithanyofhashed", "no trim"],
      ["endswithanyofhashed", "no trim"],
      ["notendswithanyofhashed", "no trim"],
      //semver comparators user values trimmed because of backward compatibility
      ["semverisoneof", "4 trim"],
      ["semverisnotoneof", "5 trim"],
      ["semverless", "6 trim"],
      ["semverlessequals", "7 trim"],
      ["semvergreater", "8 trim"],
      ["semvergreaterequals", "9 trim"],
      //number and date comparators user values trimmed because of backward compatibility
      ["numberequals", "10 trim"],
      ["numbernotequals", "11 trim"],
      ["numberless", "12 trim"],
      ["numberlessequals", "13 trim"],
      ["numbergreater", "14 trim"],
      ["numbergreaterequals", "15 trim"],
      ["datebefore", "18 trim"],
      ["dateafter", "19 trim"],
      //"contains any of" and "not contains any of" is a special case, the not trimmed user attribute checked against not trimmed comparator values.
      ["containsanyof", "no trim"],
      ["notcontainsanyof", "no trim"],
    ]) {
    it(`Comparison attribute trimming - key: ${key}`, async () => {
      const configLocation = new LocalFileConfigLocation("test", "data", "comparison_attribute_trimming.json");
      const config = await configLocation.fetchConfigAsync();

      const fakeLogger = new FakeLogger();
      const logger = new LoggerWrapper(fakeLogger);
      const evaluator = new RolloutEvaluator(logger);

      const user = new User(" 12345 ", void 0, "[\" USA \"]", {
        ["Version"]: " 1.0.0 ",
        ["Number"]: " 3 ",
        ["Date"]: " 1705253400 "
      });

      const evaluationDetails = evaluate(evaluator, config.settings, key, "default", user!, null, logger);

      assert.strictEqual(evaluationDetails.value, expectedReturnValue);
    });
  }

  for (const [key, expectedReturnValue] of
    <[string, string][]>[
      ["isoneof", "no trim"],
      ["isnotoneof", "no trim"],
      ["containsanyof", "no trim"],
      ["notcontainsanyof", "no trim"],
      ["isoneofhashed", "no trim"],
      ["isnotoneofhashed", "no trim"],
      ["equalshashed", "no trim"],
      ["notequalshashed", "no trim"],
      ["arraycontainsanyofhashed", "no trim"],
      ["arraynotcontainsanyofhashed", "no trim"],
      ["equals", "no trim"],
      ["notequals", "no trim"],
      ["startwithanyof", "no trim"],
      ["notstartwithanyof", "no trim"],
      ["endswithanyof", "no trim"],
      ["notendswithanyof", "no trim"],
      ["arraycontainsanyof", "no trim"],
      ["arraynotcontainsanyof", "no trim"],
      ["startwithanyofhashed", "no trim"],
      ["notstartwithanyofhashed", "no trim"],
      ["endswithanyofhashed", "no trim"],
      ["notendswithanyofhashed", "no trim"],
      //semver comparator values trimmed because of backward compatibility
      ["semverisoneof", "4 trim"],
      ["semverisnotoneof", "5 trim"],
      ["semverless", "6 trim"],
      ["semverlessequals", "7 trim"],
      ["semvergreater", "8 trim"],
      ["semvergreaterequals", "9 trim"],
    ]) {
    it(`Comparison value trimming - key: ${key}`, async () => {
      const configLocation = new LocalFileConfigLocation("test", "data", "comparison_value_trimming.json");
      const config = await configLocation.fetchConfigAsync();

      const fakeLogger = new FakeLogger();
      const logger = new LoggerWrapper(fakeLogger);
      const evaluator = new RolloutEvaluator(logger);

      const user = new User("12345", void 0, "[\"USA\"]", {
        ["Version"]: "1.0.0",
        ["Number"]: "3",
        ["Date"]: "1705253400"
      });

      const evaluationDetails = evaluate(evaluator, config.settings, key, "default", user!, null, logger);

      assert.strictEqual(evaluationDetails.value, expectedReturnValue);
    });
  }

});
