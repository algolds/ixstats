// src/lib/onoma/template-phonetics.test.ts
// Benchmark test suite for IRL cultures, templates, and "Hello World" phonetic derivation

import {
  translateToIPA,
  resolveNamePhonetics,
  getCultureRules,
} from "./phonology";
import {
  TEMPLATE_PHONETIC_PROFILES,
  getTemplateLinguisticProfile,
  getAllTemplateLinguisticProfiles,
} from "./template-phonetics";

describe("Plan 132: Customized IRL Culture & Template Phonetics Engine", () => {
  // --------------------------------------------------------------------------
  // Benchmark 1: Canonical "Hello World" Across 13 IRL Linguistic Families
  // --------------------------------------------------------------------------
  describe("Canonical 'Hello World' Phonetic Benchmark Across 13 IRL Cultures", () => {
    test("translates 'Hello World' with Latin / Romance phonotactics", () => {
      const res = translateToIPA("Hello World", "latin");
      expect(res).toBe("/ˈhello ˈwoɾld/");
    });

    test("translates 'Hello World' with Germanic phonotactics (w -> v, r -> ʁ)", () => {
      const res = translateToIPA("Hello World", "germanic");
      expect(res).toBe("/ˈhello ˈvoʁld/");
    });

    test("translates 'Hello World' with Celtic phonotactics (ll -> ɬ voiceless lateral, w -> ʊ, r -> ɾ)", () => {
      const res = translateToIPA("Hello World", "celtic");
      expect(res).toBe("/ˈheɬo ˈʊoɾld/");
    });

    test("translates 'Hello World' with Slavic phonotactics (h -> x velar fricative, w -> v)", () => {
      const res = translateToIPA("Hello World", "slavic");
      expect(res).toBe("/ˈxello ˈvorld/");
    });

    test("translates 'Hello World' with Arabic phonotactics (h -> ħ pharyngeal fricative, r -> ɾ)", () => {
      const res = translateToIPA("Hello World", "arabic");
      expect(res).toBe("/ˈħello ˈwoɾld/");
    });

    test("translates 'Hello World' with Uralic phonotactics (w/v -> v)", () => {
      const res = translateToIPA("Hello World", "uralic");
      expect(res).toBe("/ˈhello ˈvorld/");
    });

    test("translates 'Hello World' with Indic phonotactics (w -> ʋ labiodental approximant, r -> ɾ)", () => {
      const res = translateToIPA("Hello World", "indic");
      expect(res).toBe("/ˈhello ˈʋoɾld/");
    });

    test("translates 'Hello World' with Persian phonotactics (w -> v, r -> ɾ)", () => {
      const res = translateToIPA("Hello World", "persian");
      expect(res).toBe("/ˈhello ˈvoɾld/");
    });

    test("translates 'Hello World' with Turkic phonotactics (w -> v, r -> ɾ)", () => {
      const res = translateToIPA("Hello World", "turkic");
      expect(res).toBe("/ˈhello ˈvoɾld/");
    });

    test("translates 'Hello World' with East-Asian phonotactics (r -> ɾ liquid flap)", () => {
      const res = translateToIPA("Hello World", "east-asian");
      expect(res).toBe("/ˈhello ˈwoɾld/");
    });
  });

  // --------------------------------------------------------------------------
  // Benchmark 2: Canonical "Hello World" Across Fantasy Species & Templates
  // --------------------------------------------------------------------------
  describe("Canonical 'Hello World' Benchmark Across Fantasy Templates", () => {
    test("translates 'Hello World' in Elven (Sindarin)", () => {
      const res = translateToIPA("Hello World", "species:elf");
      expect(res).toBe("/ˈhello ˈworld/");
    });

    test("translates 'Hello World' in Dwarven (Khuzdul)", () => {
      const res = translateToIPA("Hello World", "species:dwarf");
      expect(res).toBe("/ˈhello ˈworld/");
    });

    test("translates 'Hello World' in Noble Norman", () => {
      const res = translateToIPA("Hello World", "noble:norman");
      expect(res).toBe("/ˈhello ˈworld/");
    });
  });

  // --------------------------------------------------------------------------
  // Benchmark 3: Template-Specific Phoneme & Affix Realism Tests
  // --------------------------------------------------------------------------
  describe("Template-Specific Phoneme & Affix Realism", () => {
    test("accurately translates Elven (Sindarin) dental fricatives and voiceless liquids", () => {
      // dh -> [ð], th -> [θ], ch -> [x], lh -> [ɬ], ë -> [ɛ]
      expect(translateToIPA("Galdhor", "species:elf")).toBe("/ˈɡalðor/");
      expect(translateToIPA("Celeborn", "species:elf")).toBe("/ˈkeleborn/");
      expect(translateToIPA("Lhûn", "species:elf")).toBe("/ˈɬûn/");
      expect(translateToIPA("Fëanor", "species:elf")).toBe("/ˈfɛanor/");
    });

    test("accurately translates Dwarven (Khuzdul) aspirated velars and stops", () => {
      // kh -> [x], gh -> [ɣ], th -> [tʰ], u -> [ʊ]
      expect(translateToIPA("Khazad", "species:dwarf")).toBe("/ˈxazad/");
      expect(translateToIPA("Gabilgathol", "species:dwarf")).toBe("/ˈɡabilɡatʰol/");
      expect(translateToIPA("Dum", "species:dwarf")).toBe("/ˈdʊm/");
    });

    test("accurately translates Orcish (Black Speech) gutturals and clusters", () => {
      // gh -> [ɣ], zg -> [zɡ], ur -> [ʊr], k -> [kʼ]
      expect(translateToIPA("Lugburz", "species:orc")).toBe("/ˈluɡbʊrz/");
      expect(translateToIPA("Nazgul", "species:orc")).toBe("/ˈnɑzɡul/");
      expect(translateToIPA("Uruk", "species:orc")).toBe("/ˈʊrukʼ/");
    });

    test("accurately translates Goblin sharp affricates and terminal clicks", () => {
      // x -> [ks], q -> [q], zz -> [ts]
      expect(translateToIPA("Krazzik", "species:goblin")).toBe("/ˈkratsɪk/");
      expect(translateToIPA("Xix", "species:goblin")).toBe("/ˈksiks/");
    });

    test("accurately translates Draconic elongated sibilants and velars", () => {
      // ss -> [sː], zz -> [zː], yr -> [yːr]
      expect(translateToIPA("Ignispyr", "species:dragon")).toBe("/ˈignispyːr/");
      expect(translateToIPA("Vazzoth", "species:dragon")).toBe("/ˈvazːoθ/");
    });

    test("accurately translates Noble Norman aristocratic prefixes", () => {
      // fitz -> [fɪts], de la -> [də lɑ], le -> [lə]
      expect(translateToIPA("Fitzgerald", "noble:norman")).toBe("/ˈfɪtsgerald/");
      expect(translateToIPA("de la Roche", "noble:norman")).toBe("/ˈdə ˈla ˈroʃe/");
      expect(translateToIPA("le Blanc", "noble:norman")).toBe("/ˈlə ˈblanc/");
    });

    test("accurately translates Noble Norse patronymic suffixes", () => {
      // -dottir -> [dɔh.tɪr], -son -> [sɔn], af -> [aːv]
      expect(translateToIPA("Eriksdottir", "noble:norse")).toBe("/ˈeriksdɔh.tɪr/");
      expect(translateToIPA("Ragnarson", "noble:norse")).toBe("/ˈragnarsɔn/");
      expect(translateToIPA("af Trollheimen", "noble:norse")).toBe("/ˈaːv ˈtrollheimen/");
    });

    test("accurately translates Noble Celtic clannic markers", () => {
      // mac -> [mək], o' -> [oː], ap -> [ap]
      expect(translateToIPA("MacLeod", "noble:celtic")).toBe("/ˈməkleod/");
      expect(translateToIPA("O'Brien", "noble:celtic")).toBe("/ˈoːbrien/");
      expect(translateToIPA("ap Rhys", "noble:celtic")).toBe("/ˈap ˈrhys/");
    });

    test("accurately translates Noble Germanic locatives and titles", () => {
      // von -> [fɔn], zu -> [tsuː], auf -> [aʊf]
      expect(translateToIPA("von Richthofen", "noble:germanic")).toBe("/ˈfɔn ˈrixthofen/");
      expect(translateToIPA("zu Hohenlohe", "noble:germanic")).toBe("/ˈtsuː ˈhohenlohe/");
    });

    test("accurately translates Noble Arabic lineage particles", () => {
      // ibn -> [ʔɪbn], bin -> [bɪn], al- -> [æl.]
      expect(translateToIPA("Ibn Battuta", "noble:arabic")).toBe("/ˈʔɪbn ˈbattuta/");
      expect(translateToIPA("Al-Rashid", "noble:arabic")).toBe("/ˈæl.-ˈraʃid/");
    });
  });

  // --------------------------------------------------------------------------
  // Benchmark 4: 5-Tier Hierarchical Resolver & Linguistic Registry
  // --------------------------------------------------------------------------
  describe("5-Tier Hierarchical Phonetic Resolver", () => {
    test("retrieves template profiles via getTemplateLinguisticProfile", () => {
      const elf = getTemplateLinguisticProfile("person", "elf");
      expect(elf).not.toBeNull();
      expect(elf!.bcp47VoiceTag).toBe("cy-GB");
      expect(elf!.kokoroVoicePersona).toBe("bf_emma");

      const tavern = getTemplateLinguisticProfile("organization", "tavern");
      expect(tavern).not.toBeNull();
      expect(tavern!.bcp47VoiceTag).toBe("en-GB");
    });

    test("resolves template phonetics when category and subType are supplied", () => {
      const res = resolveNamePhonetics("Galdhor", {
        category: "person",
        subType: "elf",
      });
      expect(res.source).toBe("template");
      expect(res.bcp47VoiceTag).toBe("cy-GB");
      expect(res.kokoroVoicePersona).toBe("bf_emma");
      expect(res.ipa).toBe("/ˈɡalðor/");
    });

    test("resolves culture family when no template matches", () => {
      const res = resolveNamePhonetics("Schmidt", { culture: "germanic" });
      expect(res.source).toBe("culture");
      expect(res.bcp47VoiceTag).toBe("de-DE");
      expect(res.ipa).toBe("/ˈʃmidt/");
    });

    test("honors explicit IPA overrides over template and culture rules", () => {
      const res = resolveNamePhonetics("Elrond", {
        category: "person",
        subType: "elf",
        explicitIpa: "/ˈɛl.rɒnd/",
      });
      expect(res.source).toBe("override");
      expect(res.ipa).toBe("/ˈɛl.rɒnd/");
    });

    test("returns all registered template linguistic profiles", () => {
      const profiles = getAllTemplateLinguisticProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(18);
      for (const p of profiles) {
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(p.bcp47VoiceTag).toBeTruthy();
        expect(p.rules.length).toBeGreaterThan(0);
      }
    });
  });
});
