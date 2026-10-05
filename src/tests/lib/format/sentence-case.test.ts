import { sentenceCase } from "~/lib/format/sentence-case";

describe("sentenceCase", () => {
  it.each([
    ["EARN_BONUS", "Earn bonus"],
    ["bonus:spring_event", "Bonus spring event"],
    ["  already  spaced ", "Already spaced"],
    ["", ""],
  ])("%j -> %j", (input, expected) => {
    expect(sentenceCase(input)).toBe(expected);
  });
});
