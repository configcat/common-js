import { assert } from "chai";
import "mocha";
import { User } from "../src/index";
import { WellKnownUserObjectAttribute, getUserAttributes } from "../src/User";
import { parseFloatStrict } from "../src/Utils";

const identifierAttribute: WellKnownUserObjectAttribute = "Identifier";
const emailAttribute: WellKnownUserObjectAttribute = "Email";
const countryAttribute: WellKnownUserObjectAttribute = "Country";

describe("User Object", () => {

  for (const [identifier, expectedValue] of <[string, string][]>[
    [void 0, ""],
    [null, ""],
    ["", ""],
    ["id", "id"],
    ["\t", "\t"],
    ["\u1F600", "\u1F600"],
  ]) {
    it(`Create user - should set id - identifier: ${identifier}`, () => {
      const user = new User(identifier);

      assert.strictEqual(getUserAttributes(user)[identifierAttribute], expectedValue);
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
      let actualAttributeValue: string;
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

});
