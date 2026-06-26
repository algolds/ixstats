// src/lib/onoma/browser-speech.test.ts
// Onoma Lab — Browser speech spelling utility unit tests

import { ipaToSpeechSpelling } from "./branding-utils";

describe("ipaToSpeechSpelling", () => {
  it("translates common IPA names to readable spelling syllables with proper stressed capitalization", () => {
    expect(ipaToSpeechSpelling("/ʃəˈnoʊmə/")).toBe("shuh-NOH-muh");
    expect(ipaToSpeechSpelling("[laˈtiːn]")).toBe("lah-TEEN");
  });

  it("translates phonetic characters correctly", () => {
    // θ -> th, ð -> th, ʃ -> sh, dʒ -> j
    expect(ipaToSpeechSpelling("/θəˈðə/")).toBe("thuh-THUH");
    expect(ipaToSpeechSpelling("/dʒeɪ/")).toBe("JAY");
  });

  it("handles single syllable words", () => {
    expect(ipaToSpeechSpelling("ʃ")).toBe("SH");
    expect(ipaToSpeechSpelling("/aɪ/")).toBe("EYE");
  });

  it("gracefully returns empty strings for empty input", () => {
    expect(ipaToSpeechSpelling("")).toBe("");
  });
});
