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
