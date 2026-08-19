import {
  ipaToKokoroPhonemes,
  anglicizeForSpeech,
  KOKORO_VALID_TOKENS,
  KOKORO_REMAP,
} from "./kokoro-phonemes";
import { translateToIPA } from "./phonology";

describe("anglicizeForSpeech", () => {
  it("reduces unstressed cardinal vowels to schwa, keeps the stressed nucleus", () => {
    expect(anglicizeForSpeech("ˈdelepas")).toBe("ˈdɛləpəs");
  });

  it("maps stressed cardinal o → oʊ", () => {
    expect(anglicizeForSpeech("ˈtola")).toBe("ˈtoʊlə");
  });

  it("leaves diphthongs and long vowels untouched, reducing only the bare trailing vowel", () => {
    expect(anglicizeForSpeech("ˈnoʊva")).toBe("ˈnoʊvə");
    expect(anglicizeForSpeech("laˈtiːn")).toBe("ləˈtiːn");
  });

  it("does not touch already-English vowels (ɛ æ ɪ ə …)", () => {
    expect(anglicizeForSpeech("ˌæktɪˈveɪʃən")).toBe("ˌæktɪˈveɪʃən");
  });

  it("preserves word-initial cardinal vowels as clear onsets rather than hesitation schwa", () => {
    expect(anglicizeForSpeech("/onoma/")).toBe("/oʊnəmə/");
    expect(anglicizeForSpeech("/aragon/")).toBe("/ɑrəgən/");
  });

  it("returns empty for blank input", () => {
    expect(anglicizeForSpeech("")).toBe("");
  });

  it("output still normalizes to valid kokoro tokens", () => {
    const { phonemes } = ipaToKokoroPhonemes(
      anglicizeForSpeech(translateToIPA("Delepas", "latin"))
    );
    const allowed = new Set<string>();
    for (const t of KOKORO_VALID_TOKENS) for (const ch of t) allowed.add(ch);
    for (const ch of phonemes) expect(allowed.has(ch)).toBe(true);
  });
});

describe("ipaToKokoroPhonemes", () => {
  it("strips slash/bracket delimiters", () => {
    expect(ipaToKokoroPhonemes("/ɪmˈpɛɾia/").phonemes).toBe("ɪmˈpɛɾia");
    expect(ipaToKokoroPhonemes("[laˈtiːn]").phonemes).toBe("laˈtiːn");
  });

  it("remaps known non-English tokens to nearest misaki-en equivalent", () => {
    expect(ipaToKokoroPhonemes("ʁ").phonemes).toBe("ɹ");
    expect(ipaToKokoroPhonemes("x").phonemes).toBe("k");
    expect(ipaToKokoroPhonemes("ɣ").phonemes).toBe("ɡ");
    expect(ipaToKokoroPhonemes("ɬ").phonemes).toBe("l");
    expect(ipaToKokoroPhonemes("r").phonemes).toBe("ɹ");
    expect(ipaToKokoroPhonemes("y").phonemes).toBe("iː");
    expect(ipaToKokoroPhonemes("ø").phonemes).toBe("ɛ");
    expect(ipaToKokoroPhonemes("œ").phonemes).toBe("ɛ");
    expect(ipaToKokoroPhonemes("q").phonemes).toBe("k");
    expect(ipaToKokoroPhonemes("g").phonemes).toBe("ɡ");
    expect(ipaToKokoroPhonemes("c").phonemes).toBe("k");
  });

  it("keeps the tap ɾ (valid in misaki en)", () => {
    expect(ipaToKokoroPhonemes("ɾ").phonemes).toBe("ɾ");
  });

  it("drops the glottal stop and records it", () => {
    const r = ipaToKokoroPhonemes("bʊʔər");
    expect(r.phonemes).toBe("bʊəɹ");
    expect(r.dropped).toContain("ʔ");
  });

  it("preserves stress and length marks", () => {
    expect(ipaToKokoroPhonemes("/ˈiːzli/").phonemes).toBe("ˈiːzli");
    expect(ipaToKokoroPhonemes("/ˌæktɪˈveɪʃən/").phonemes).toBe("ˌæktɪˈveɪʃən");
  });

  it("drops unknown tokens and records them", () => {
    const r = ipaToKokoroPhonemes("çaɸ");
    // ç and ɸ are unknown (no remap); the 'a' between them passes through.
    expect(r.phonemes).toBe("a");
    expect(r.dropped).toEqual(expect.arrayContaining(["ç", "ɸ"]));
  });

  it("returns empty for blank IPA", () => {
    expect(ipaToKokoroPhonemes("")).toEqual({ phonemes: "", dropped: [] });
    expect(ipaToKokoroPhonemes("//").phonemes).toBe("");
    expect(ipaToKokoroPhonemes("[]").phonemes).toBe("");
  });

  it("collapses repeated whitespace and trims", () => {
    const r = ipaToKokoroPhonemes("/ˈnoʊvə   ˈroʊma/");
    expect(r.phonemes).toBe("ˈnoʊvə ˈɹoʊma");
  });

  it("normalizes a realistic IPA string end-to-end", () => {
    // latin "Imperia" -> /ˈimpeɾia/ -> ɾ kept, no drops, no slashes
    const r = ipaToKokoroPhonemes(translateToIPA("Imperia", "latin"));
    expect(r.phonemes).toBe("ˈimpeɾia");
    expect(r.dropped).toEqual([]);
    expect(r.phonemes).not.toContain("/");
  });

  it("emits only valid Kokoro tokens for a battery of Onoma names", () => {
    // Build the allowed character set from the valid-token inventory. Remap
    // targets are themselves valid tokens, so their characters are covered.
    const allowedChars = new Set<string>();
    for (const t of KOKORO_VALID_TOKENS) for (const ch of t) allowedChars.add(ch);

    const cases: [string, string][] = [
      ["Imperia", "latin"],
      ["Vlachezar", "slavic"],
      ["Adelhardt", "germanic"],
      ["Caoimhe", "celtic"],
      ["Rahmani", "arabic"],
      ["Sakura", "east-asian"],
      ["Tane", "austronesian"],
      ["Aelith", "constructed"],
      ["Novus Roma", "latin"],
    ];

    for (const [name, culture] of cases) {
      const ipa = translateToIPA(name, culture);
      const { phonemes } = ipaToKokoroPhonemes(ipa);
      for (const ch of phonemes) {
        if (!allowedChars.has(ch)) {
          throw new Error(
            `Invalid char ${JSON.stringify(ch)} (U+${ch
              .codePointAt(0)!
              .toString(
                16
              )}) in normalized phonemes "${phonemes}" for ${name}/${culture} (ipa=${ipa})`
          );
        }
      }
    }
  });

  it("remap targets are all valid tokens (no garble can be emitted via remap)", () => {
    for (const target of KOKORO_REMAP.values()) {
      if (!target) continue; // empty = drop, not an emitted token
      // Every emitted character of a remap target must be in the valid inventory.
      for (const ch of target) {
        expect(
          KOKORO_VALID_TOKENS.has(ch) || [...KOKORO_VALID_TOKENS].some((t) => t.includes(ch))
        ).toBe(true);
      }
    }
  });
});
