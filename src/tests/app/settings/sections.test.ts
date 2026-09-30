import { SETTINGS_SECTIONS, type SettingSectionId } from "~/app/settings/_lib/sections";

describe("SETTINGS_SECTIONS Registry", () => {
  it("should contain exactly 10 consolidated settings sections", () => {
    expect(SETTINGS_SECTIONS).toHaveLength(10);
  });

  it("should have unique IDs for all sections", () => {
    const ids = SETTINGS_SECTIONS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should define valid configuration properties for each section", () => {
    const validIds: SettingSectionId[] = [
      "account",
      "country",
      "appearance",
      "wikios",
      "notifications",
      "social",
      "privacy",
      "vault",
      "cosmetics",
      "cards",
    ];

    for (const section of SETTINGS_SECTIONS) {
      expect(validIds).toContain(section.id);
      expect(section.label).toBeTruthy();
      expect(section.description).toBeTruthy();
      expect(section.category).toBeTruthy();
      expect(section.icon).toBeDefined();
      expect(section.glyphClass).toMatch(/^bg-/);
      expect(section.accentColor).toMatch(/^text-/);
    }
  });

  it("should mark country section as requiring a country", () => {
    const countrySection = SETTINGS_SECTIONS.find((s) => s.id === "country");
    expect(countrySection).toBeDefined();
    expect(countrySection?.requiresCountry).toBe(true);
  });
});
