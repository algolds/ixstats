import { describe, it, expect } from "@jest/globals";
import {
  deriveDemonym,
  formatCeremonialName,
  POPULAR_CURRENCIES,
  getHighResFlagUrl,
  deriveIsoCode,
  deriveInternetTld,
  deriveCallingCode,
} from "../components/enhanced/national-identity/identityUtils";

describe("identityUtils", () => {
  describe("deriveDemonym", () => {
    it("handles empty and whitespace strings", () => {
      expect(deriveDemonym("")).toBe("");
      expect(deriveDemonym("   ")).toBe("");
    });

    it("handles irregular country names", () => {
      expect(deriveDemonym("United States")).toBe("American");
      expect(deriveDemonym("France")).toBe("French");
      expect(deriveDemonym("Spain")).toBe("Spanish");
      expect(deriveDemonym("Germany")).toBe("German");
      expect(deriveDemonym("Japan")).toBe("Japanese");
      expect(deriveDemonym("Greece")).toBe("Greek");
      expect(deriveDemonym("Switzerland")).toBe("Swiss");
      expect(deriveDemonym("Netherlands")).toBe("Dutch");
    });

    it("derives regular demonyms correctly", () => {
      expect(deriveDemonym("Eldoria")).toBe("Eldorian");
      expect(deriveDemonym("Canada")).toBe("Canadan");
      expect(deriveDemonym("Italy")).toBe("Italian");
      expect(deriveDemonym("Finland")).toBe("Finlander");
      expect(deriveDemonym("Monaco")).toBe("Monacan");
      expect(deriveDemonym("Vanuatu")).toBe("Vanuatuan");
    });
  });

  describe("formatCeremonialName", () => {
    it("returns empty string if country name is empty", () => {
      expect(formatCeremonialName("", "Republic")).toBe("");
      expect(formatCeremonialName("   ", "Republic")).toBe("");
    });

    it("formats known government types with correct prefix", () => {
      expect(formatCeremonialName("Eldoria", "Republic")).toBe("The Republic of Eldoria");
      expect(formatCeremonialName("Eldoria", "Kingdom")).toBe("The Kingdom of Eldoria");
      expect(formatCeremonialName("Eldoria", "Federation")).toBe("The Federation of Eldoria");
      expect(formatCeremonialName("Eldoria", "Commonwealth")).toBe("The Commonwealth of Eldoria");
      expect(formatCeremonialName("Eldoria", "Principality")).toBe("The Principality of Eldoria");
    });

    it("handles custom or unlisted types gracefully", () => {
      expect(formatCeremonialName("Eldoria", "custom")).toBe("Eldoria");
      expect(formatCeremonialName("Eldoria", "Other")).toBe("Eldoria");
      expect(formatCeremonialName("Eldoria", "Magocracy")).toBe("The Magocracy of Eldoria");
    });
  });

  describe("POPULAR_CURRENCIES", () => {
    it("contains essential real and fictional currency presets", () => {
      const codes = POPULAR_CURRENCIES.map((c) => c.code);
      expect(codes).toContain("USD");
      expect(codes).toContain("EUR");
      expect(codes).toContain("GBP");
      expect(codes).toContain("Taler");
      expect(codes).toContain("Crown");
      expect(codes).toContain("Credit");
    });
  });

  describe("getHighResFlagUrl", () => {
    it("transforms flagcdn png URLs to svg", () => {
      expect(getHighResFlagUrl("https://flagcdn.com/w320/us.png")).toBe("https://flagcdn.com/us.svg");
      expect(getHighResFlagUrl("https://flagcdn.com/w160/fr.webp")).toBe("https://flagcdn.com/fr.svg");
    });

    it("returns null or undefined as is", () => {
      expect(getHighResFlagUrl(null)).toBeNull();
      expect(getHighResFlagUrl(undefined)).toBeUndefined();
    });

    it("leaves non-flagcdn URLs untouched", () => {
      expect(getHighResFlagUrl("https://ixwiki.com/flag.png")).toBe("https://ixwiki.com/flag.png");
    });
  });

  describe("deriveIsoCode", () => {
    it("handles single-word country names", () => {
      expect(deriveIsoCode("Eldoria")).toBe("EL");
      expect(deriveIsoCode("France")).toBe("FR");
    });

    it("handles multi-word country names by taking initials", () => {
      expect(deriveIsoCode("United States")).toBe("US");
      expect(deriveIsoCode("New Zealand")).toBe("NZ");
      expect(deriveIsoCode("Kingdom of Eldoria")).toBe("KE");
    });

    it("handles empty or whitespace strings", () => {
      expect(deriveIsoCode("")).toBe("");
      expect(deriveIsoCode("   ")).toBe("");
    });
  });

  describe("deriveInternetTld", () => {
    it("derives TLD from ISO code if available", () => {
      expect(deriveInternetTld("Eldoria", "EL")).toBe(".el");
      expect(deriveInternetTld("United States", "US")).toBe(".us");
    });

    it("derives TLD from country name when ISO code is missing", () => {
      expect(deriveInternetTld("Eldoria")).toBe(".el");
      expect(deriveInternetTld("New Zealand")).toBe(".nz");
    });
  });

  describe("deriveCallingCode", () => {
    it("deterministically generates calling code from country name", () => {
      const code1 = deriveCallingCode("Eldoria");
      const code2 = deriveCallingCode("Eldoria");
      expect(code1).toBe(code2);
      expect(code1.startsWith("+")).toBe(true);
    });

    it("returns empty string for empty input", () => {
      expect(deriveCallingCode("")).toBe("");
      expect(deriveCallingCode("   ")).toBe("");
    });
  });
});

