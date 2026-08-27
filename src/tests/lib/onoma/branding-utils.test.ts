import { ipaToSpeechSpelling, ipaToSpokenText } from "~/lib/onoma/branding-utils";

describe("ipaToSpeechSpelling (chunk-based)", () => {
  it("keeps the existing contract", () => {
    expect(ipaToSpeechSpelling("/ʃəˈnoʊmə/")).toBe("shuh-NOH-muh");
    expect(ipaToSpeechSpelling("[laˈtiːn]")).toBe("lah-TEEN");
    expect(ipaToSpeechSpelling("/θəˈðə/")).toBe("thuh-THUH");
    expect(ipaToSpeechSpelling("/dʒeɪ/")).toBe("JAY");
    expect(ipaToSpeechSpelling("ʃ")).toBe("SH");
    expect(ipaToSpeechSpelling("/aɪ/")).toBe("EYE");
    expect(ipaToSpeechSpelling("")).toBe("");
  });

  it("does not treat the h in vowel digraphs as a consonant", () => {
    // was the choppy "ih-MPEH-reea-h"
    expect(ipaToSpeechSpelling("/ɪmˈpɛɾia/")).toBe("ihm-PEH-ree-ah");
    // ks is one chunk so it bonds to the following syllable — EH-ksahmpl is correct
    expect(ipaToSpeechSpelling("/ˈeksɑːmpl/")).toBe("EH-ksahmpl");
  });

  it("re-spells each word and preserves separators", () => {
    expect(ipaToSpeechSpelling("/ˈnoʊvə ˈroʊma/")).toBe("NOH-vuh ROH-mah");
  });

  it("produces clean syllable onsets for words starting with vowels", () => {
    expect(ipaToSpeechSpelling("/oʊˈnoʊmə/")).toBe("oh-NOH-muh");
    expect(ipaToSpeechSpelling("/ˈɑrəgən/")).toBe("AH-ruh-guhn");
  });
});

describe("ipaToSpokenText", () => {
  it("lower-cases and space-separates the re-spelling for kokoro", () => {
    expect(ipaToSpokenText("/ʃəˈnoʊmə/")).toBe("shuh noh muh");
  });
  it("returns empty for blank IPA", () => {
    expect(ipaToSpokenText("")).toBe("");
    expect(ipaToSpokenText("//")).toBe("");
  });
});


// src/lib/onoma/browser-speech.test.ts
// Onoma Lab — Browser speech spelling utility unit tests

import { ipaToSpeechSpelling } from "~/lib/onoma/branding-utils";

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
