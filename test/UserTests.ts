import { assert } from "chai";
import "mocha";
import { User } from "../src/index";
import { WellKnownUserObjectAttribute, getUserAttributes } from "../src/User";

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

});
