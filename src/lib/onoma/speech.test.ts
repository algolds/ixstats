import { ipaToEspeak, voiceForCulture } from "./speech";

describe("ipaToEspeak", () => {
  test("strips /…/ delimiters and maps IPA symbols to eSpeak codes", () => {
    expect(ipaToEspeak("/θomas/")).toBe("Tomas");
    expect(ipaToEspeak("/ʃiɾa/")).toBe("Sira");
    expect(ipaToEspeak("/dʒon/")).toBe("dZon");
  });

  test("leading primary stress becomes eSpeak '", () => {
    expect(ipaToEspeak("/ˈtiberius/")).toBe("'tiberius");
  });

  test("maps schwa and special vowels", () => {
    expect(ipaToEspeak("/əŋ/")).toBe("@N");
    expect(ipaToEspeak("/køln/")).toBe("k2ln");
  });

  test("plain ASCII passes through; output has no IPA artifacts", () => {
    const out = ipaToEspeak("/marko/");
    expect(out).toBe("marko");
    expect(out).not.toMatch(/[/ˈθʃ]/);
  });
});

describe("voiceForCulture", () => {
  test("maps cultures (and compounds) to eSpeak voices, en fallback", () => {
    expect(voiceForCulture("latin")).toBe("la");
    expect(voiceForCulture("germanic+slavic")).toBe("de"); // primary wins
    expect(voiceForCulture("klingon")).toBe("en/en");
    expect(voiceForCulture(null)).toBe("en/en");
  });
});
