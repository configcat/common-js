import { assert } from "chai";
import "mocha";
import { ProjectConfig } from "../src/ProjectConfig";

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

  it("Equals - One of the tags is 'undefined' and json strings are equal - Should equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", undefined);
    const expected: ProjectConfig = new ProjectConfig(1, "{}", "W/\"etag\"");

    assert.isTrue(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Both tags are 'undefined' and json strings are equal - Should equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", undefined);
    const expected: ProjectConfig = new ProjectConfig(1, "{}", undefined);

    assert.isTrue(ProjectConfig.equals(actual, expected));
  });

  it("Equals - One of the tags is 'undefined' and json strings are not equal - Should not equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{\"f\": {}}", "W/\"etag\"");
    const expected: ProjectConfig = new ProjectConfig(1, "{}", undefined);

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Both tags are 'undefined' and json strings are not equal - Should not equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{\"f\": {}}", undefined);
    const expected: ProjectConfig = new ProjectConfig(1, "{}", undefined);

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Both tags are 'undefined' - Should equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", undefined);
    const expected: ProjectConfig = new ProjectConfig(1, "{}", undefined);

    assert.isTrue(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Actual is null - Should not equal", () => {
    const actual: ProjectConfig | null = null;
    const expected: ProjectConfig = new ProjectConfig(1, "{}", 'etag');

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Expected is null - Should not equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", 'etag');
    const expected: ProjectConfig | null = null;

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Both actual and expected are null - Should equal", () => {
    const actual: ProjectConfig | null = null;
    const expected: ProjectConfig | null = null;

    assert.isTrue(ProjectConfig.equals(actual, expected));
  });

  it("Equals - Case-sensitive equals - Should not equal", () => {
    const actual: ProjectConfig = new ProjectConfig(1, "{}", 'etag');
    const expected: ProjectConfig = new ProjectConfig(1, "{}", 'ETAG');

    assert.isFalse(ProjectConfig.equals(actual, expected));
  });
});