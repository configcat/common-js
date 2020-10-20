import { assert } from "chai";
import "mocha";
import { ProjectConfig } from "../src";

describe("ProjectConfig", () => {
  it("Equals - Same etag values - Should equal", () => {
      const actual: ProjectConfig = new ProjectConfig(1, "{}", "etag");
      const expected: ProjectConfig = new ProjectConfig(1, "{}", "etag");

      assert.isTrue(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Different etag values - Should not equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", "etag");
    const expected: ProjectConfig = new ProjectConfig(1, "{}", "different-etag");

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Actual etag is week - Should equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", "W/\"etag\"");
    const expected: ProjectConfig = new ProjectConfig(1, "{}", "\"etag\"");

    assert.isTrue(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Both tags are weak - Should equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", "W/\"etag\"");
    const expected: ProjectConfig = new ProjectConfig(1, "{}", "W/\"etag\"");

    assert.isTrue(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Actual etag is 'undefined' - Should not equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", undefined);
    const expected: ProjectConfig = new ProjectConfig(1, "{}", "W/\"etag\"");

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Both tags are 'undefined' - Should equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", undefined);
    const expected: ProjectConfig = new ProjectConfig(1, "{}", undefined);

    assert.isTrue(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Actual etag is null, expected etag is 'undefined'  - Should not equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", null);
    const expected: ProjectConfig = new ProjectConfig(1, "{}", undefined);

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Actual is null - Should not equal", () => {
    const actual: ProjectConfig = null;
    const expected: ProjectConfig = new ProjectConfig(1, "{}", 'etag');

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Expected is null - Should not equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", 'etag');
    const expected: ProjectConfig = null;

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });
});