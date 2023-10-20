import { assert } from "chai";
import "mocha";
import { sha1, sha256 } from "../src/Hash";

describe("Hash functions", () => {
  for (const [input, expectedOutput] of [
    ["", "da39a3ee5e6b4b0d3255bfef95601890afd80709"],
    ["abc", "a9993e364706816aba3e25717850c26c9cd0d89d"],
    ["<árvíztűrő tükörfúrógép | ÁRVÍZTŰRŐ TÜKÖRFÚRÓGÉP>", "1be0a50a536668a6ff6c9650e13c2c09f011f3d8"],
    ["\u{0} \u{7F}\n\u{80} \u{7FF}\n\u{800} \u{FFFF}\n\u{10000} \u{10FFFF}\r\n", "b7cd3a8fe37c968f87d9d2eb581a42c94952a890"],
  ]) {
    it(`sha1 should work - input: '${input}'`, () => {
      let actualOutput = sha1(input);
      assert.equal(actualOutput, expectedOutput);
      actualOutput = sha1(input);
      assert.equal(actualOutput, expectedOutput);
    });
  }

  for (const [input, expectedOutput] of [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["<árvíztűrő tükörfúrógép | ÁRVÍZTŰRŐ TÜKÖRFÚRÓGÉP>", "8a396060d6d54c97112c2d420144d528f4b1d824c66a83b54070b0f0bb8cafa7"],
    ["\u{0} \u{7F}\n\u{80} \u{7FF}\n\u{800} \u{FFFF}\n\u{10000} \u{10FFFF}\r\n", "306979857214e80b4eee7caf751d38c7491147fa62ed2980f4fd6d7398479b9b"],
  ]) {
    it(`sha256 should work - input: '${input}'`, () => {
      let actualOutput = sha256(input);
      assert.equal(actualOutput, expectedOutput);
      actualOutput = sha256(input);
      assert.equal(actualOutput, expectedOutput);
    });
  }
});
