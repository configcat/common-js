import { assert } from "chai";
import "mocha";
import { ProjectConfig } from "../src";

describe("ProjectConfig", () => {
  it("Equals - Same etag values - Should equal", () => {
      const actual: ProjectConfig = new ProjectConfig(1, "{}", "etag")
      const expected: ProjectConfig = new ProjectConfig(1, "{}", "etag")

      assert.isTrue(actual.Equals(expected));
  });

  it("Equals - Different etag values - Should not equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", "etag")
    const expected: ProjectConfig = new ProjectConfig(1, "{}", "different-etag")

    assert.isFalse(actual.Equals(expected));
  });

  it("Equals - Actual etag is week - Should equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", "W/\"etag\"")
    const expected: ProjectConfig = new ProjectConfig(1, "{}", "\"etag\"")

    assert.isTrue(actual.Equals(expected));
  });

  it("Equals - Both tags are weak - Should equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", "W/\"etag\"")
    const expected: ProjectConfig = new ProjectConfig(1, "{}", "W/\"etag\"")

    assert.isTrue(actual.Equals(expected));
  });

});