// src/lib/onoma/phonology.test.ts
// Onoma Lab — Phonology Unit Tests

import { translateToIPA } from "~/lib/onoma/phonology";

describe("Phonology Grapheme-to-IPA Parser", () => {
  describe("Fallback rules", () => {
    it("should translate generic words correctly", () => {
      // "test" -> "t", "e", "s", "t". First vowel is "e". Onset consonant is "t".
      expect(translateToIPA("test", "any")).toBe("/ˈtest/");
      expect(translateToIPA("ship", null)).toBe("/ˈʃip/");
    });
  });

  describe("Germanic rules", () => {
    it("should map w to v, v to f, sch to ʃ, and r to ʁ", () => {
      expect(translateToIPA("Schmidt", "germanic")).toBe("/ˈʃmidt/");
      expect(translateToIPA("Verona", "germanic")).toBe("/ˈfeʁona/");
    });
  });

  describe("Latin rules", () => {
    it("should map soft c (before e) to ts, v to w, and r to ɾ", () => {
      // Venceia -> w + e + n + ts + e + i + a. First vowel "e", onset "w".
      expect(translateToIPA("Venceia", "latin")).toBe("/ˈwentseia/");
      expect(translateToIPA("Carthago", "latin")).toBe("/ˈkaɾtaɡo/");
    });
  });

  describe("Slavic rules", () => {
    it("should map sz to ʃ, cz to tʃ, and y to i", () => {
      expect(translateToIPA("Czern", "slavic")).toBe("/ˈtʃern/");
    });
  });

  describe("Constructed / Tolkien rules", () => {
    it("should map dh to ð and th to θ", () => {
      expect(translateToIPA("Dhar", "constructed")).toBe("/ˈðaɾ/");
      expect(translateToIPA("Mithril", "constructed")).toBe("/ˈmiθɾil/");
    });
  });

  describe("Compounds and multi-word names", () => {
    it("should parse compound cultures (using primary/first component)", () => {
      // germanic+slavic should resolve to germanic
      expect(translateToIPA("Verona", "germanic+slavic")).toBe("/ˈfeʁona/");
    });

    it("should handle spaces and hyphens keeping stress for each word token", () => {
      const res = translateToIPA("New-Venceia", "latin");
      expect(res).toBe("/ˈnew-ˈwentseia/");
    });
  });
});


// src/lib/onoma/orthography.test.ts
// Onoma Lab — Unit tests for Orthography Script Transcriber

import { transcribeToScript } from "~/lib/onoma/orthography";

describe("Orthography Transcriber", () => {
  describe("Cyrillic Script", () => {
    it("should transcribe standard names correctly", () => {
      expect(transcribeToScript("Verona", "cyrillic")).toBe("Верона");
      expect(transcribeToScript("Pompeii", "cyrillic")).toBe("Помпеии");
      expect(transcribeToScript("Schmidt", "cyrillic")).toBe("Шмидт");
    });
  });

  describe("Greek Script", () => {
    it("should transcribe standard names correctly, handling final sigmas", () => {
      expect(transcribeToScript("Verona", "greek")).toBe("Βερονα");
      expect(transcribeToScript("Helios", "greek")).toBe("Ελιος");
      expect(transcribeToScript("Thales", "greek")).toBe("Θαλες");
    });
  });

  describe("Arabic Script", () => {
    it("should transcribe standard names into RTL Arabic tokens", () => {
      expect(transcribeToScript("Roma", "arabic")).toBe("روما");
      expect(transcribeToScript("Kareth", "arabic")).toBe("كاريث");
    });
  });

  describe("Fallback", () => {
    it("should return the original name for unsupported scripts", () => {
      expect(transcribeToScript("Verona", "unsupported" as any)).toBe("Verona");
    });
  });
});
