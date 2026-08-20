// src/lib/onoma/vowel-formants.test.ts
// Unit tests for Acoustic Phonetics & IPA Vowel Formant Calculations

import {
  IPA_VOWEL_FORMANTS,
  extractVowelsFromIpa,
  f1ToY,
  f2ToX,
  calculateAcousticCenter,
} from "~/lib/onoma/vowel-formants";

describe("vowel-formants", () => {
  test("extracts vowels from IPA transcription correctly", () => {
    // English 'father' /ˈfɑː.ðə/
    const vowels1 = extractVowelsFromIpa("/ˈfɑː.ðə/");
    expect(vowels1.map((v) => v.ipa)).toEqual(["ɑ", "ə"]);

    // Latin 'civitas' /ˈkiː.wi.taːs/
    const vowels2 = extractVowelsFromIpa("/ˈkiː.wi.taːs/");
    expect(vowels2.map((v) => v.ipa)).toEqual(["i", "i", "a"]);

    // Empty IPA string
    expect(extractVowelsFromIpa("")).toEqual([]);
  });

  test("computes acoustic center of gravity", () => {
    const vowels = [IPA_VOWEL_FORMANTS["i"]!, IPA_VOWEL_FORMANTS["u"]!];
    const center = calculateAcousticCenter(vowels);
    expect(center).not.toBeNull();
    // i: f1=280, f2=2250; u: f1=300, f2=800 -> avg f1=(280+300)/2=290, avg f2=(2250+800)/2=1525
    expect(center?.f1).toBe(290);
    expect(center?.f2).toBe(1525);
  });

  test("maps F1 and F2 to inverted chart coordinates", () => {
    const width = 400;
    const height = 300;
    const padding = 20;

    // High front vowel /i/ (low F1 280 -> near top, high F2 2250 -> near left)
    const i = IPA_VOWEL_FORMANTS["i"]!;
    const y_i = f1ToY(i.f1, height, padding);
    const x_i = f2ToX(i.f2, width, padding);

    // Low back vowel /ɑ/ (high F1 700 -> near bottom, low F2 1100 -> near right)
    const a = IPA_VOWEL_FORMANTS["ɑ"]!;
    const y_a = f1ToY(a.f1, height, padding);
    const x_a = f2ToX(a.f2, width, padding);

    expect(y_i).toBeLessThan(y_a); // /i/ is higher on screen than /ɑ/
    expect(x_i).toBeLessThan(x_a); // /i/ is further left on screen (fronter) than /ɑ/
  });
});
