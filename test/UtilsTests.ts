import { assert } from "chai";
import "mocha";
import { formatStringList, parseFloatStrict, utf8Encode } from "../src/Utils";

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
});
