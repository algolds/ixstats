/**
 * Onoma's language engines on a corpus of real and in-world names: transcription to each culture's IPA, the speech
 * the TTS engine can say, other scripts, declension, historical sound change, the wiki lexicon's cleaning and culture
 * classification, and name generation. One table per engine.
 */
import { ipaToSpeechSpelling, ipaToSpokenText } from "~/lib/onoma/branding-utils";
import { CULTURAL_PROFILES } from "~/lib/onoma/cultural-profiles";
import {
  anglicizeForSpeech,
  ipaToKokoroPhonemes,
  KOKORO_VALID_TOKENS,
} from "~/lib/onoma/kokoro-phonemes";
import { cleanLexicon, cleanName } from "~/lib/onoma/lexicon/clean";
import { classifyCulture, CULTURES } from "~/lib/onoma/lexicon/culture-classifier";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { detectGender, generateNounDeclension } from "~/lib/onoma/morphology";
import { transcribeToScript } from "~/lib/onoma/orthography";
import { naturalnessScore, perplexity, trainLM } from "~/lib/onoma/perplexity";
import { translateToIPA } from "~/lib/onoma/phonology";
import { applySoundShifts, SOUND_SHIFT_PRESETS } from "~/lib/onoma/sound-shifts";

const ROMAN = [
  "Marcus",
  "Lucius",
  "Gaius",
  "Julius",
  "Tiberius",
  "Claudius",
  "Verona",
  "Roma",
  "Carthago",
  "Ravenna",
  "Mediolanum",
  "Aquileia",
  "Capua",
  "Brundisium",
  "Tarentum",
];

describe("Onoma on real names", () => {
  it.each([
    ["Schmidt", "germanic", "/ˈʃmidt/"],
    ["Verona", "germanic", "/ˈfeʁona/"],
    ["Verona", "germanic+slavic", "/ˈfeʁona/"],
    ["Carthago", "latin", "/ˈkaɾtaɡo/"],
    ["New-Venceia", "latin", "/ˈnew-ˈwentseia/"],
    ["Czern", "slavic", "/ˈtʃern/"],
    ["Mithril", "constructed", "/ˈmiθɾil/"],
    ["Hello World", "celtic", "/ˈheɬo ˈʊoɾld/"],
    ["Hello World", "arabic", "/ˈħello ˈwoɾld/"],
    ["Hello World", "indic", "/ˈhello ˈʋoɾld/"],
    ["Galdhor", "species:elf", "/ˈɡalðor/"],
    ["Khazad", "species:dwarf", "/ˈxazad/"],
    ["Uruk", "species:orc", "/ˈʊrukʼ/"],
    ["Fitzgerald", "noble:norman", "/ˈfɪtsgerald/"],
    ["ship", null, "/ˈʃip/"],
  ])("transcribes %s in %s phonology as %s", (name, culture, ipa) => {
    expect(translateToIPA(name, culture)).toBe(ipa);
  });

  it("hands the TTS engine only tokens it can say, for names of every culture", () => {
    const allowed = new Set([...KOKORO_VALID_TOKENS].flatMap((token) => [...token]));
    const names: Array<[string, string]> = [
      ["Imperia", "latin"],
      ["Vlachezar", "slavic"],
      ["Adelhardt", "germanic"],
      ["Caoimhe", "celtic"],
      ["Rahmani", "arabic"],
      ["Sakura", "east-asian"],
      ["Tane", "austronesian"],
      ["Aelith", "constructed"],
      ["Novus Roma", "latin"],
      ["Delepas", "latin"],
    ];
    for (const [name, culture] of names) {
      for (const ipa of [
        translateToIPA(name, culture),
        anglicizeForSpeech(translateToIPA(name, culture)),
      ]) {
        const bad = [...ipaToKokoroPhonemes(ipa).phonemes].filter((ch) => !allowed.has(ch));
        expect({ name, ipa, bad }).toEqual({ name, ipa, bad: [] });
      }
    }
    expect(ipaToKokoroPhonemes(translateToIPA("Imperia", "latin"))).toMatchObject({
      phonemes: "ˈimpeɾia",
      dropped: [],
    });
    expect(ipaToKokoroPhonemes("bʊʔər")).toMatchObject({ phonemes: "bʊəɹ", dropped: ["ʔ"] });
    expect(anglicizeForSpeech("/onoma/")).toBe("/oʊnəmə/");
  });

  it.each([
    ["/ʃəˈnoʊmə/", "shuh-NOH-muh"],
    ["/ɪmˈpɛɾia/", "ihm-PEH-ree-ah"],
    ["/ˈnoʊvə ˈroʊma/", "NOH-vuh ROH-mah"],
    ["/ˈɑrəgən/", "AH-ruh-guhn"],
  ])("re-spells %s for a browser voice as %s", (ipa, spelling) => {
    expect(ipaToSpeechSpelling(ipa)).toBe(spelling);
    expect(ipaToSpokenText(ipa)).toBe(spelling.toLowerCase().replace(/-/g, " "));
  });

  it.each([
    ["Schmidt", "cyrillic", "Шмидт"],
    ["Helios", "greek", "Ελιος"],
    ["Kareth", "arabic", "كاريث"],
    ["Verona", "unsupported", "Verona"],
  ])("writes %s in the %s script as %s", (name, script, written) => {
    expect(transcribeToScript(name, script as never)).toBe(written);
  });

  it.each([
    [
      "Roma",
      "Latin",
      "feminine",
      { nominative: { singular: "Roma", plural: "Romae" }, genitive: { plural: "Romarum" } },
    ],
    [
      "Marcus",
      "Latin",
      "masculine",
      { nominative: { plural: "Marci" }, genitive: { plural: "Marcorum" } },
    ],
    [
      "Helios",
      "Greek",
      "masculine",
      { genitive: { singular: "Heliou" }, accusative: { plural: "Helious" } },
    ],
    ["Mädchen", "Germanic", "neuter", {}],
  ])("declines %s as a %s noun (%s)", (name, culture, gender, table) => {
    expect(detectGender(name, culture)).toBe(gender);
    expect(generateNounDeclension(name, culture)).toMatchObject(table);
  });

  it("evolves names through the presets' sound changes, step by step", () => {
    const grimm = SOUND_SHIFT_PRESETS.find((p) => p.id === "grimms-law")!;
    const [pater, deka, dhwer] = applySoundShifts(["pater", "deka", "dʰwer"], grimm.epochs);
    expect([pater!.final, deka!.final, dhwer!.final]).toEqual(["faθer", "teha", "dwer"]);
    expect(pater!.steps[0]).toMatchObject({
      before: "pater",
      after: "fater",
      epochName: expect.stringContaining("Phase 1"),
    });
    const romance = SOUND_SHIFT_PRESETS.find((p) => p.id === "latin-to-romance")!;
    expect(
      applySoundShifts(["civitas", "ripa", "aurum"], romance.epochs).map((r) => r.final)
    ).toEqual(["tʃividas", "riba", "auru"]);
  });

  it.each([
    ["Sydalon (city)", "city", "Sydalon"],
    ["Castelle County, Verona", "city", "Castelle County"],
    ["West T'kampa", "city", "West T'kampa"],
    ["Republic of Nasastan", "country", "Nasastan"],
    ["Rhys I of Faneria", "person", "Rhys"],
    ["Queen Elizabeth II", "person", "Elizabeth"],
    ["Isle of Man", "city", "Isle of Man"],
    ["Doclea", "city", "Doclea"],
    ["Category:Stub pages", "city", null],
    ["List of countries", "city", null],
    ["Socialist Party", "organization", null],
    ["Infobox cheese/doc", "culture_cuisine", null],
    ["1607-1860", "country", null],
  ])("cleans the wiki title %s (%s) to %s", (raw, category, cleaned) => {
    expect(cleanName(raw, category as never)).toBe(cleaned);
  });

  it("keeps one of each name per category, from every wiki", () => {
    const out = cleanLexicon([
      { name: "Roma", category: "city", sourceWiki: "ixwiki" },
      { name: "roma", category: "city", sourceWiki: "iiwiki" },
      { name: "Roma", category: "person", sourceWiki: "ixwiki" },
      { name: "Sydalon (city)", category: "city", sourceWiki: "iiwiki" },
    ] as never);
    expect(
      out.map((r: { category: string; name: string }) => `${r.category}:${r.name}`).sort()
    ).toEqual(["city:Roma", "city:Sydalon", "person:Roma"]);
  });

  it("names a name's culture, a blend as a compound, and is right most of the time on its own corpus", () => {
    for (const [name, culture] of [
      ["Quintus", "latin"],
      ["Gunnar", "germanic"],
      ["Khalid", "arabic"],
      ["Vladimir", "slavic"],
    ]) {
      expect(classifyCulture(name!)).toMatchObject({ compound: false, culture });
    }
    const blend = classifyCulture("Kensonia");
    expect(blend.compound && blend.culture === [...blend.components].sort().join("+")).toBe(true);
    expect(classifyCulture("1234").culture).toBe("mixed");
    let commit = 0;
    let correct = 0;
    for (const culture of CULTURES) {
      const profile = (
        CULTURAL_PROFILES as unknown as Record<string, Record<string, string[] | undefined>>
      )[culture]!;
      for (const name of [
        ...(profile.person ?? []),
        ...(profile.city ?? []),
        ...(profile.country ?? []),
      ]) {
        const r = classifyCulture(name);
        if (r.compound) continue;
        commit++;
        if (r.culture === culture) correct++;
      }
    }
    expect(correct / commit).toBeGreaterThan(0.7);
  });

  it("generates new names in a lexicon's style, under the asked constraints, never one it was taught", () => {
    const chain = new MarkovChain(2);
    chain.addWords(["Constantinus", "Constantia", "Constantius", ...ROMAN]);
    const name = chain.generate({ startsWith: "Con", endsWith: "us", maxAttempts: 200 });
    expect(name).toMatch(/^Con.*us$/);
    expect(chain.isDuplicate(name!)).toBe(false);
    expect(chain.isDuplicate("roma")).toBe(true);
    expect(new MarkovChain().generate()).toBeNull();
    const lm = trainLM(ROMAN, 3);
    expect(perplexity("Marcellus", lm)).toBeLessThan(perplexity("Xqzkbwth", lm));
    expect(naturalnessScore("Tiberius", lm)).toBeGreaterThan(naturalnessScore("Xqzkbwth", lm));
    expect(naturalnessScore("", lm)).toBe(0);
  });
});
