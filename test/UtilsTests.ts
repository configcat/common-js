import { assert } from "chai";
import "mocha";
import { FetchError } from "../src/ConfigFetcher";
import { errorToString, formatStringList, parseFloatStrict, utf8Encode } from "../src/Utils";

describe("Utils", () => {

  for (const [input, expectedOutput] of <[string, number[]][]>[
    ["", []],
    [" ", [0x20]],
    ["<a ~ \x85 \u076b \u0812 \ufffe \u{1f4a9}>", [0x3C, 0x61, 0x20, 0x7E, 0x20, 0xC2, 0x85, 0x20, 0xDD, 0xAB, 0x20, 0xE0, 0xA0, 0x92, 0x20, 0xEF, 0xBF, 0xBE, 0x20, 0xF0, 0x9F, 0x92, 0xA9, 0x3E]],
  ]) {
    it(`utf8encode - input: ${input}`, () => {
      const actualOutput = utf8Encode(input);
      assert.deepEqual([...actualOutput].map(ch => ch.charCodeAt(0)), expectedOutput);
    });
  }

  for (const [input, expectedOutput] of <[string, number][]>[
    ["", NaN],
    [" ", NaN],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["+Infinity", Infinity],
    ["-Infinity", -Infinity],
    ["1", 1],
    ["1 ", 1],
    [" 1", 1],
    [" 1 ", 1],
    ["0x1", NaN],
    [" 0x1", NaN],
    ["+0x1", NaN],
    ["-0x1", NaN],
    ["1f", NaN],
    ["1e", NaN],
    ["0+", NaN],
    ["0-", NaN],
    ["2023.11.13", NaN],
    ["0", 0],
    ["-0", 0],
    ["+0", 0],
    ["0e+1", 0],
    ["0E+1", 0],
    ["1234567890", 1234567890],
    ["1234567890.0", 1234567890],
    ["1234567890e0", 1234567890],
    [".1234567890", 0.1234567890],
    ["+.1234567890", 0.1234567890],
    ["-.1234567890", -0.1234567890],
    ["+0.123e-3", 0.000123],
    ["+0.123E-3", 0.000123],
    ["-0.123e+3", -123],
    ["-0.123E+3", -123],
  ]) {
    it(`parseFloatStrict - input: ${input}`, () => {
      const actualOutput = parseFloatStrict(input);
      assert.isNumber(actualOutput);
      if (isNaN(expectedOutput)) {
        assert.isNaN(actualOutput);
      }
      else {
        assert.strictEqual(actualOutput, expectedOutput);
      }
    });
  }

  for (const [items, maxLength, addOmittedItemsText, separator, expectedOutput] of <[string[], number, boolean, string | undefined, string][]>[
    [[], 0, false, void 0, ""],
    [[], 1, true, void 0, ""],
    [["a"], 0, false, void 0, "'a'"],
    [["a"], 1, true, void 0, "'a'"],
    [["a"], 1, true, " -> ", "'a'"],
    [["a", "b", "c"], 0, false, void 0, "'a', 'b', 'c'"],
    [["a", "b", "c"], 3, false, void 0, "'a', 'b', 'c'"],
    [["a", "b", "c"], 2, false, void 0, "'a', 'b'"],
    [["a", "b", "c"], 2, true, void 0, "'a', 'b', ...1 item(s) omitted"],
    [["a", "b", "c"], 0, true, " -> ", "'a' -> 'b' -> 'c'"],
  ]) {
    it(`formatStringList - items: ${items} | maxLength: ${maxLength} | addOmittedItemsText: ${addOmittedItemsText}`, () => {
      const actualOutput = formatStringList(items, maxLength, addOmittedItemsText ? count => `, ...${count} item(s) omitted` : void 0, separator);
      assert.strictEqual(actualOutput, expectedOutput);
    });
  }

  it("errorToString - basic error without stack trace", () => {
    const message = "Something went wrong.";
    try {
      throw new FetchError("failure", message);
    }
    catch (err) {
      const expected = `${FetchError.name}: Request failed due to a network or protocol error. ${message}`;
      const actual = errorToString(err);
      assert.equal(actual, expected);
    }
  });

  it("errorToString - basic error with stack trace", () => {
    const message = "Something went wrong.";
    try {
      throw new FetchError("failure", message);
    }
    catch (err) {
      const expectedMessage = `${FetchError.name}: Request failed due to a network or protocol error. ${message}`;
      const actualLines = errorToString(err, true).split("\n");
      assert.equal(actualLines[0], expectedMessage);
      const stackTrace = actualLines.slice(1);
      assert.isNotEmpty(stackTrace);
      assert.isTrue(stackTrace.every(line => line.startsWith("    at ")));
    }
  });

  it("errorToString - aggregate error without stack trace", function() {
    if (typeof AggregateError === "undefined") {
      this.skip();
    }

    const message1 = "Something went wrong.";
    const message2 = "Aggregated error.";
    const message3 = "Another error.";

    let error1: Error, error2: Error, innerAggregateError: Error, fetchError: Error;
    try { throw Error(); }
    catch (err) { error1 = err as Error; }
    try { throw message3; }
    catch (err) { error2 = err as Error; }
    try { throw AggregateError([error1, error2], message2); }
    catch (err) { innerAggregateError = err as Error; }
    try { throw new FetchError("failure", message1); }
    catch (err) { fetchError = err as Error; }

    try {
      throw AggregateError([innerAggregateError, fetchError]);
    }
    catch (err) {
      const expected = AggregateError.name + "\n"
        + `--> ${AggregateError.name}: ${message2}\n`
        + `    --> ${Error.name}\n`
        + `    --> ${message3}\n`
        + `--> ${FetchError.name}: Request failed due to a network or protocol error. ${message1}`;

      const actual = errorToString(err);
      assert.equal(actual, expected);
    }
  });

  it("errorToString - aggregate error with stack trace", function() {
    if (typeof AggregateError === "undefined") {
      this.skip();
    }

    const message1 = "Something went wrong.";
    const message2 = "Aggregated error.";
    const message3 = "Another error.";

    let error1: Error, error2: Error, innerAggregateError: Error, fetchError: Error;
    try { throw Error(); }
    catch (err) { error1 = err as Error; }
    try { throw message3; }
    catch (err) { error2 = err as Error; }
    try { throw AggregateError([error1, error2], message2); }
    catch (err) { innerAggregateError = err as Error; }
    try { throw new FetchError("failure", message1); }
    catch (err) { fetchError = err as Error; }

    try {
      throw AggregateError([innerAggregateError, fetchError]);
    }
    catch (err) {
      const expectedMessages = [
        AggregateError.name,
        `--> ${AggregateError.name}: ${message2}`,
        `    --> ${Error.name}`,
        `    --> ${message3}`,
        `--> ${FetchError.name}: Request failed due to a network or protocol error. ${message1}`,
      ];
      const actualLines = errorToString(err, true).split("\n");
      assert.equal(actualLines[0], expectedMessages[0]);

      let expectedMessageIndex = 1;
      let requireStackTraceLine = true;
      for (const actualLine of actualLines.slice(1)) {
        if (!requireStackTraceLine && actualLine === expectedMessages[expectedMessageIndex]) {
          expectedMessageIndex++;
          requireStackTraceLine = expectedMessageIndex !== 4;
        }
        else {
          const indent =
            expectedMessageIndex === 1 ? ""
            : expectedMessageIndex === 2 || expectedMessageIndex === 5 ? "    "
            : "        ";
          assert.isTrue(actualLine.startsWith(indent + "    at "), "Line: " + actualLine);
          requireStackTraceLine = false;
        }
      }
      assert.strictEqual(expectedMessageIndex, expectedMessages.length);
    }
  });
});
