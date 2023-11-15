import { assert } from "chai";
import "mocha";
import { LogLevel, LoggerWrapper } from "../src/ConfigCatLogger";
import { User } from "../src/index";
import { Config } from "../src/ProjectConfig";
import { RolloutEvaluator, evaluate } from "../src/RolloutEvaluator";
import { WellKnownUserObjectAttribute, getUserAttributes } from "../src/User";
import { parseFloatStrict } from "../src/Utils";
import { FakeLogger } from "./helpers/fakes";

const identifierAttribute: WellKnownUserObjectAttribute = "Identifier";
const emailAttribute: WellKnownUserObjectAttribute = "Email";
const countryAttribute: WellKnownUserObjectAttribute = "Country";

function createUser(attributeName: string, attributeValue: string) {
  const user = new User("");
  switch (attributeName) {
    case identifierAttribute:
      user.identifier = attributeValue;
      break;
    case emailAttribute:
      user.email = attributeValue;
      break;
    case countryAttribute:
      user.country = attributeValue;
      break;
    default:
      user.custom[attributeName] = attributeValue;
  }
  return user;
}

describe("User Object", () => {

  for (const [attributeName, attributeValue, expectedValue] of <[string, string, string][]>[
    [identifierAttribute, void 0, ""],
    [identifierAttribute, null, ""],
    [identifierAttribute, "", ""],
    [identifierAttribute, "id", "id"],
    [identifierAttribute, "\t", "\t"],
    [identifierAttribute, "\u1F600", "\u1F600"],
    [emailAttribute, void 0, void 0],
    [emailAttribute, null, void 0],
    [emailAttribute, "", ""],
    [emailAttribute, "a@example.com", "a@example.com"],
    [countryAttribute, void 0, void 0],
    [countryAttribute, null, void 0],
    [countryAttribute, "", ""],
    [countryAttribute, "US", "US"],
    ["Custom1", void 0, void 0],
    ["Custom1", null, void 0],
    ["Custom1", "", ""],
    ["Custom1", "3.14", "3.14"],
  ]) {
    it(`Create user - should set attribute value - ${attributeName}: ${attributeValue}`, () => {
      const user = createUser(attributeName, attributeValue);

      assert.strictEqual(getUserAttributes(user)[attributeName], expectedValue);
    });
  }

  it("Create User with id, email and country - all attributes should contain passed values", () => {
    // Arrange

    const user = new User("id", "id@example.com", "US");

    // Act

    const actualAttributes = getUserAttributes(user);

    // Assert

    assert.strictEqual(actualAttributes[identifierAttribute], "id");
    assert.strictEqual(actualAttributes[emailAttribute], "id@example.com");
    assert.strictEqual(actualAttributes[countryAttribute], "US");

    assert.equal(3, Object.keys(actualAttributes).length);
  });

  it("Use well-known attributes as custom properties - should not append all attributes", () => {
    // Arrange

    const user = new User("id", "id@example.com", "US", {
      myCustomAttribute: "myCustomAttributeValue",
      [identifierAttribute]: "myIdentifier",
      [countryAttribute]: "United States",
      [emailAttribute]: "otherEmail@example.com"
    });

    // Act

    const actualAttributes = getUserAttributes(user);

    // Assert

    assert.strictEqual(actualAttributes[identifierAttribute], "id");
    assert.strictEqual(actualAttributes[emailAttribute], "id@example.com");
    assert.strictEqual(actualAttributes[countryAttribute], "US");
    assert.strictEqual(actualAttributes["myCustomAttribute"], "myCustomAttributeValue");

    assert.equal(4, Object.keys(actualAttributes).length);
  });

  for (const [attributeName, attributeValue] of <[string, string][]>[
    ["identifier", "myId"],
    ["IDENTIFIER", "myId"],
    ["email", "theBoss@example.com"],
    ["EMAIL", "theBoss@example.com"],
    ["eMail", "theBoss@example.com"],
    ["country", "myHome"],
    ["COUNTRY", "myHome"],
  ]) {
    it(`Use well-known attributes as custom properties with different casings - should append all attributes - attributeName: ${attributeName} | attributeValue: ${attributeValue}`, () => {
      // Arrange

      const user = new User("id", "id@example.com", "US", {
        [attributeName]: attributeValue,
      });

      // Act

      const actualAttributes = getUserAttributes(user);

      // Assert

      assert.strictEqual(actualAttributes[attributeName], attributeValue);

      assert.equal(4, Object.keys(actualAttributes).length);
    });
  }

  it("Non-standard instantiation should work", () => {
    // Arrange

    const user = {
      identifier: "id",
      email: "id@example.com",
      country: "US",
      custom: {
        myCustomAttribute: "myCustomAttributeValue"
      }
    };

    // Act

    const actualAttributes = getUserAttributes(user);

    // Assert

    assert.strictEqual(actualAttributes[identifierAttribute], "id");
    assert.strictEqual(actualAttributes[emailAttribute], "id@example.com");
    assert.strictEqual(actualAttributes[countryAttribute], "US");
    assert.strictEqual(actualAttributes["myCustomAttribute"], "myCustomAttributeValue");

    assert.equal(4, Object.keys(actualAttributes).length);
  });

  type AttributeValueType = "datetime" | "number" | "stringlist";

  for (const [type, value, expectedAttributeValue] of <[AttributeValueType, string, string][]>[
    ["datetime", "2023-09-19T11:01:35.0000000+00:00", "1695121295"],
    ["datetime", "2023-09-19T13:01:35.0000000+02:00", "1695121295"],
    ["datetime", "2023-09-19T11:01:35.0510886+00:00", "1695121295.051"],
    ["datetime", "2023-09-19T13:01:35.0510886+02:00", "1695121295.051"],
    ["number", "3", "3"],
    ["number", "3.14", "3.14"],
    ["number", "-1.23e-100", "-1.23e-100"],
    ["stringlist", "a,,b,c", "[\"a\",\"\",\"b\",\"c\"]"],
  ]) {
    it(`Attribute value helper methods should work - type: ${type} | value: ${value}`, () => {
      let actualAttributeValue: string | undefined;
      switch (type) {
        case "datetime":
          const date = new Date(value);
          actualAttributeValue = User.attributeValueFromDate(date);
          break;
        case "number":
          const number = parseFloatStrict(value);
          actualAttributeValue = User.attributeValueFromNumber(number);
          break;
        case "stringlist":
          const items = value.split(",");
          actualAttributeValue = User.attributeValueFromStringArray(...items);
          break;
        default:
          throw new Error();
      }

      assert.strictEqual(actualAttributeValue, expectedAttributeValue);
    });
  }

  for (const [attributeName, attributeValue, comparisonValue] of <[string, unknown, string][]>[
    [identifierAttribute, false, "false"],
    [emailAttribute, false, "false"],
    [countryAttribute, false, "false"],
    ["Custom1", false, "false"],
    [identifierAttribute, 1.23, "1.23"],
    [emailAttribute, 1.23, "1.23"],
    [countryAttribute, 1.23, "1.23"],
    ["Custom1", 1.23, "1.23"],
  ]) {
    it(`Non-string attribute values should be handled - attributeName: ${attributeName} | attributeValue: ${attributeValue}`, () => {
      const configJson = {
        "f": {
          "test": {
            "t": 0,
            "r": [
              {
                "c": [
                  {
                    "u": { "a": attributeName, "c": 1, "l": [comparisonValue] }
                  }
                ],
                "s": { "v": { "b": false } }
              },
              {
                "c": [
                  {
                    "u": { "a": attributeName, "c": 0, "l": [comparisonValue] }
                  }
                ],
                "s": { "v": { "b": true } }
              },
            ],
            "v": { "b": false }
          }
        }
      };

      const config = new Config(configJson);
      const fakeLogger = new FakeLogger();
      const logger = new LoggerWrapper(fakeLogger);
      const evaluator = new RolloutEvaluator(logger);

      const user = createUser(attributeName, attributeValue as any);
      const evaluationDetails = evaluate(evaluator, config.settings, "test", null, user, null, logger);
      const actualReturnValue = evaluationDetails.value;

      assert.isTrue(actualReturnValue);

      const warnings = fakeLogger.events.filter(([level]) => level === LogLevel.Warn);

      assert.strictEqual(1, warnings.length);

      const [, eventId] = warnings[0];
      assert.strictEqual(4004, eventId);
    });
  }

});
