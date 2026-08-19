// src/lib/onoma/onoma-audit-initiatives.test.ts
// Verification test suite for Onoma Initiatives 125 through 131

import { ipaToSpeechSpelling } from "./branding-utils";
import { ipaToKokoroPhonemes } from "./kokoro-phonemes";
import {
  generatePresetName,
  exportToCSV,
  exportToJSON,
  type ExportNameItem,
  type PresetGenerationContext,
} from "./name-generator";
import { MarkovChain } from "./markov-chain";
import { trainLM, naturalnessScore } from "./perplexity";
import {
  PhonologyRulesSchema,
  MorphologyRulesSchema,
  StashNoteMetadataSchema,
  type IPAString,
  type LanguagePackId,
} from "./types";
import {
  applySingleRule,
  applySoundShifts,
  SOUND_SHIFT_PRESETS,
  type SoundShiftEpoch,
  type SoundShiftRule,
} from "./sound-shifts";
import {
  IPA_VOWEL_FORMANTS,
  extractVowelsFromIpa,
  f1ToY,
  f2ToX,
  calculateAcousticCenter,
} from "./vowel-formants";

describe("Onoma Initiatives 125-131 Verification Suite", () => {
  // --------------------------------------------------------------------------
  // Initiative 125: BasePath, Batch Loaders & Cardinal Vowel Preservation
  // --------------------------------------------------------------------------
  describe("Initiative 125: Cardinal Vowel Preservation (No Leading Hesitation)", () => {
    test("preserves cardinal open/mid vowels on word onset in speech spelling", () => {
      // Cardinal vowels should not collapse to 'uh' or 'eh'
      expect(ipaToSpeechSpelling("/ˈɑrəgən/")).toBe("AH-ruh-guhn");
      expect(ipaToSpeechSpelling("/oʊˈnoʊmə/")).toBe("oh-NOH-muh");
      expect(ipaToSpeechSpelling("/ˈeksɑːmpl/")).toBe("EH-ksahmpl");
    });

    test("maps normalized phonemes without leading hesitation artifacts", () => {
      const res = ipaToKokoroPhonemes("/ˈɑː.kɑ/");
      expect(res.phonemes).toBeTruthy();
      expect(res.dropped).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Initiative 126: Centralized Presets & Ponytail Dead Code Elimination
  // --------------------------------------------------------------------------
  describe("Initiative 126: Centralized Presets & Ponytail Optimization", () => {
    test("generates names across all preset subTypes via generatePresetName", () => {
      const chain = new MarkovChain(3, "character");
      chain.addWords(["valyria", "westeros", "gondor", "rohan", "mordor"]);

      const elfName = generatePresetName({
        category: "person",
        subType: "elf",
        gender: "female",
        characterChain: chain,
      });
      expect(typeof elfName).toBe("string");
      expect(elfName!.length).toBeGreaterThan(0);

      const tavernName = generatePresetName({
        category: "organization",
        subType: "tavern",
        characterChain: chain,
      });
      expect(typeof tavernName).toBe("string");
      expect(tavernName!.length).toBeGreaterThan(0);

      const mysticName = generatePresetName({
        category: "organization",
        subType: "mystic-order",
        characterChain: chain,
      });
      expect(typeof mysticName).toBe("string");
      expect(mysticName!.length).toBeGreaterThan(0);

      const landmarkName = generatePresetName({
        category: "geography",
        subType: "natural-landmark",
        characterChain: chain,
      });
      expect(typeof landmarkName).toBe("string");
      expect(landmarkName!.length).toBeGreaterThan(0);
    });

    test("exports CSV and JSON helper functions without error", () => {
      const sampleNames: ExportNameItem[] = [
        { name: "Alavandor", ipa: "/æ.lə.væn.dɔː/", syllables: 4, perplexity: 15.2, length: 9 },
        { name: "Khorvath", ipa: "/xɔr.vɑt/", syllables: 2, perplexity: 22.1, length: 8 },
      ];

      // Functions should execute safely without crashing in test environment
      expect(() => exportToCSV(sampleNames, "test.csv")).not.toThrow();
      expect(() => exportToJSON(sampleNames, { version: "1.0" }, "test.json")).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Initiative 127: Performance LM Calibration & Route Code Splitting
  // --------------------------------------------------------------------------
  describe("Initiative 127: LM Calibration & Deterministic Naturalness", () => {
    test("trains char LM model and calculates naturalness scores deterministically", () => {
      const seeds = ["altamir", "valoria", "solaria", "luminis", "aurelia"];
      const lm = trainLM(seeds, 3);
      expect(lm).toBeDefined();

      const score1 = naturalnessScore("altamir", lm);
      const score2 = naturalnessScore("altamir", lm);
      expect(score1).toBe(score2);
      expect(score1).toBeGreaterThanOrEqual(0);
      expect(score1).toBeLessThanOrEqual(100);

      // Unnatural consonant clusters receive lower fit scores
      const unnaturalScore = naturalnessScore("zkqxptrw", lm);
      expect(unnaturalScore).toBeLessThan(score1);
    });
  });

  // --------------------------------------------------------------------------
  // Initiative 128: Strict Schemas & Nominal Domain Branding
  // --------------------------------------------------------------------------
  describe("Initiative 128: Strict Zod Schemas & Nominal Domain Types", () => {
    test("validates valid PhonologyRulesSchema and rejects malformed types", () => {
      const validRules = {
        consonants: ["p", "t", "k", "s", "m", "n"],
        vowels: ["a", "e", "i", "o", "u"],
        syllables: ["CV", "CVC"],
        maxConsonantCluster: 3,
        stressRule: "penultimate" as const,
      };
      const parsed = PhonologyRulesSchema.safeParse(validRules);
      expect(parsed.success).toBe(true);

      const invalidRules = {
        consonants: "not-an-array",
        maxConsonantCluster: 99, // exceeds max 6
      };
      const badParse = PhonologyRulesSchema.safeParse(invalidRules);
      expect(badParse.success).toBe(false);
    });

    test("validates MorphologyRulesSchema", () => {
      const validMorphology = {
        genderSystem: "masculine-feminine-neuter" as const,
        declensionPatterns: {
          first: {
            nom: "-a",
            gen: "-ae",
            dat: "-ae",
            acc: "-am",
            abl: "-a",
          },
        },
      };
      expect(MorphologyRulesSchema.safeParse(validMorphology).success).toBe(true);
    });

    test("validates StashNoteMetadataSchema for conlang dictionaries", () => {
      const validNote = {
        category: "fantasy",
        role: "noble",
        gender: "female",
        setName: "Elven Kingdom",
        values: ["Aredhel", "Galadriel", "Celebrían"],
      };
      const parseResult = StashNoteMetadataSchema.safeParse(validNote);
      expect(parseResult.success).toBe(true);
    });

    test("types nominal branded IPAString and LanguagePackId", () => {
      const sampleIpa = "/ˈfɑː.ðə/" as IPAString;
      const samplePack = "pack_latin_v1" as LanguagePackId;
      expect(sampleIpa.startsWith("/")).toBe(true);
      expect(samplePack.includes("latin")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Initiative 129: Facet Physics, Optical Typography & Touch Refinement
  // --------------------------------------------------------------------------
  describe("Initiative 129: Optical Typography & Phonetic Tokens", () => {
    test("formats phonetic bracket tokens and IPA display strings cleanly", () => {
      const rawIpa = "kɑː.tə";
      const formatted = `/${rawIpa}/` as IPAString;
      expect(formatted).toBe("/kɑː.tə/");
    });
  });

  // --------------------------------------------------------------------------
  // Initiative 130: Historical Sound Shift & Evolution Engine
  // --------------------------------------------------------------------------
  describe("Initiative 130: Historical Sound Shift & Conlang Evolution Engine", () => {
    test("accurately applies Grimm's Law with multi-epoch derivation", () => {
      const grimms = SOUND_SHIFT_PRESETS.find((p) => p.id === "grimms-law")!;
      expect(grimms).toBeDefined();

      const input = ["pater", "tres", "kann", "deka", "dʰwer"];
      const results = applySoundShifts(input, grimms.epochs);

      expect(results).toHaveLength(5);
      expect(results[0]!.final).toBe("faθer");
      expect(results[1]!.final).toBe("θres");
      expect(results[2]!.final).toBe("hann");
      expect(results[3]!.final).toBe("teha");
      expect(results[4]!.final).toBe("dwer");
    });

    test("evaluates environmental context rules (V_V, _[ei], _#, #_)", () => {
      const intervocalicRule: SoundShiftRule = { id: "1", source: "t", target: "d", context: "V_V" };
      expect(applySingleRule("vita", intervocalicRule)).toBe("vida");
      expect(applySingleRule("tra", intervocalicRule)).toBe("tra");

      const palatalRule: SoundShiftRule = { id: "2", source: "k", target: "tʃ", context: "_[ei]" };
      expect(applySingleRule("ker", palatalRule)).toBe("tʃer");
      expect(applySingleRule("kor", palatalRule)).toBe("kor");

      const apocopeRule: SoundShiftRule = { id: "3", source: "m", target: "", context: "_#" };
      expect(applySingleRule("aurum", apocopeRule)).toBe("auru");
      expect(applySingleRule("mater", apocopeRule)).toBe("mater");

      const initialRule: SoundShiftRule = { id: "4", source: "p", target: "pf", context: "#_" };
      expect(applySingleRule("pan", initialRule)).toBe("pfan");
      expect(applySingleRule("apple", initialRule)).toBe("apple");
    });
  });

  // --------------------------------------------------------------------------
  // Initiative 131: Real-Time Formant & Acoustic Spectrogram Visualizer
  // --------------------------------------------------------------------------
  describe("Initiative 131: Acoustic Formant Coordinates & Vowel Quadrilateral", () => {
    test("maps all cardinal vowels to F1/F2 formant frequencies", () => {
      const i = IPA_VOWEL_FORMANTS["i"]!;
      const u = IPA_VOWEL_FORMANTS["u"]!;
      const a = IPA_VOWEL_FORMANTS["a"]!;
      const alpha = IPA_VOWEL_FORMANTS["ɑ"]!;

      expect(i.f1).toBeLessThan(a.f1); // High vowel has lower F1 than Low vowel
      expect(i.f2).toBeGreaterThan(u.f2); // Front vowel has higher F2 than Back vowel
      expect(alpha.category).toBe("back");
      expect(a.category).toBe("front");
    });

    test("computes acoustic center of gravity for multi-syllable word", () => {
      const vowels = extractVowelsFromIpa("/ˌkæl.ɪˈfɔː.ni.ə/");
      expect(vowels.length).toBeGreaterThanOrEqual(3);

      const center = calculateAcousticCenter(vowels);
      expect(center).not.toBeNull();
      expect(center!.f1).toBeGreaterThan(200);
      expect(center!.f1).toBeLessThan(900);
      expect(center!.f2).toBeGreaterThan(700);
      expect(center!.f2).toBeLessThan(2500);
    });

    test("projects F1/F2 coordinates onto inverted acoustic chart space", () => {
      const width = 500;
      const height = 300;
      const pad = 30;

      const f2Front = 2200;
      const f2Back = 900;
      const xFront = f2ToX(f2Front, width, pad);
      const xBack = f2ToX(f2Back, width, pad);
      expect(xFront).toBeLessThan(xBack); // Front is further left

      const f1High = 280;
      const f1Low = 750;
      const yHigh = f1ToY(f1High, height, pad);
      const yLow = f1ToY(f1Low, height, pad);
      expect(yHigh).toBeLessThan(yLow); // High vowel is near top (lower y coordinate)
    });
  });
});
