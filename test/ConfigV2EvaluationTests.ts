import { assert } from "chai";
import "mocha";
import { FlagOverrides, IManualPollOptions, MapOverrideDataSource, OverrideBehaviour, SettingValue, User } from "../src";
import { FormattableLogMessage, LogLevel, LoggerWrapper } from "../src/ConfigCatLogger";
import { RolloutEvaluator, evaluate } from "../src/RolloutEvaluator";
import { CdnConfigLocation, LocalFileConfigLocation } from "./helpers/ConfigLocation";
import { FakeLogger } from "./helpers/fakes";
import { HttpConfigFetcher } from "./helpers/HttpConfigFetcher";
import { createClientWithManualPoll, escapeRegExp, sdkType, sdkVersion } from "./helpers/utils";

describe("Setting evaluation (config v2)", () => {

  it("Circular dependency detection", async () => {
    const configLocation = new LocalFileConfigLocation("test", "data", "test_circulardependency_v6.json");
    const config = await configLocation.fetchConfigAsync();

    const fakeLogger = new FakeLogger();
    const logger = new LoggerWrapper(fakeLogger);
    const evaluator = new RolloutEvaluator(logger);

    const key = "key1";
    evaluate(evaluator, config.settings, key, null, void 0, null, logger);

    const logEvents = fakeLogger.events;
    assert.strictEqual(4, logEvents.length);

    assert.strictEqual(3, logEvents.filter(([, eventId]) => eventId === 3005).length);

    assert.isTrue(logEvents.some(([level, , msg]) => level === LogLevel.Warn && msg instanceof FormattableLogMessage
      && msg.argValues[1] === "key1"
      && msg.argValues[2] === "'key1' -> 'key1'"));

    assert.isTrue(logEvents.some(([level, , msg]) => level === LogLevel.Warn && msg instanceof FormattableLogMessage
      && msg.argValues[1] === "key2"
      && msg.argValues[2] === "'key1' -> 'key2' -> 'key1'"));

    assert.isTrue(logEvents.some(([level, , msg]) => level === LogLevel.Warn && msg instanceof FormattableLogMessage
      && msg.argValues[1] === "key3"
      && msg.argValues[2] === "'key1' -> 'key3' -> 'key3'"));

    const evaluateLogEvent = logEvents.find(([level, eventId]) => level === LogLevel.Info && eventId === 5000);
    assert.isDefined(evaluateLogEvent);

    const msg = evaluateLogEvent![2].toString();

    assert.match(msg, new RegExp(escapeRegExp("THEN 'key1-prereq1' => cannot evaluate, circular dependency detected\n")
      + "\\s+" + escapeRegExp("The current targeting rule is ignored and the evaluation continues with the next rule.")));

    assert.match(msg, new RegExp(escapeRegExp("THEN 'key2-prereq1' => cannot evaluate, circular dependency detected\n")
      + "\\s+" + escapeRegExp("The current targeting rule is ignored and the evaluation continues with the next rule.")));

    assert.match(msg, new RegExp(escapeRegExp("THEN 'key3-prereq1' => cannot evaluate, circular dependency detected\n")
      + "\\s+" + escapeRegExp("The current targeting rule is ignored and the evaluation continues with the next rule.")));
  });

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
    it(`Prerequisite flag override - key: ${key} | userId: ${userId} | email: ${email} | overrideBehavior: ${overrideBehaviour} `, async () => {
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
