/** @jest-environment node */
/**
 * Native lore plan Task 3: the create-page templates gain Place (`Infobox settlement`) and Organisation
 * (`Infobox organization`), History switches to `Infobox event` (`Infobox historical event` does not exist on
 * ixwiki), each lore type carries its own section headings, and `options.categories` appends category lines.
 */
import { generateWikitext } from "~/components/wiki-os/shared/create-page/WikitextTemplates";

const LORE_CATEGORIES = { categories: ["Caphiria lore", "Caphiria"] };

describe("generateWikitext lore types", () => {
  it("writes a Place on Infobox settlement with its fields, headings and both category lines", () => {
    const text = generateWikitext(
      "place",
      "Venceia",
      {
        placeFields: {
          settlementType: "City",
          subdivision: "Latium",
          coordinates: "{{coord|41.9|12.5}}",
          population: "2,400,000",
        },
      },
      LORE_CATEGORIES
    );

    expect(text).toContain("{{Infobox settlement");
    expect(text).toMatch(/\| name\s+= Venceia\n/);
    expect(text).toMatch(/\| settlement_type\s+= City\n/);
    expect(text).toMatch(/\| subdivision_name\s+= Latium\n/);
    expect(text).toMatch(/\| coordinates\s+= \{\{coord\|41\.9\|12\.5\}\}\n/);
    expect(text).toMatch(/\| population_total\s+= 2,400,000\n/);
    for (const heading of ["History", "Geography", "Culture"]) {
      expect(text).toContain(`== ${heading} ==`);
    }
    expect(text).toContain("[[Category:Caphiria lore]]");
    expect(text).toContain("[[Category:Caphiria]]");
  });

  it("writes an Organisation on Infobox organization with its fields and headings", () => {
    const text = generateWikitext("organisation", "Imperial Senate", {
      organisationFields: {
        type: "Legislature",
        founded: "1012",
        headquarters: "Venceia",
        leader: "Princeps",
      },
    });

    expect(text).toContain("{{Infobox organization");
    expect(text).toMatch(/\| name\s+= Imperial Senate\n/);
    expect(text).toMatch(/\| type\s+= Legislature\n/);
    expect(text).toMatch(/\| founded\s+= 1012\n/);
    expect(text).toMatch(/\| headquarters\s+= Venceia\n/);
    expect(text).toMatch(/\| leader_name\s+= Princeps\n/);
    for (const heading of ["History", "Structure", "Activities"]) {
      expect(text).toContain(`== ${heading} ==`);
    }
  });

  it("writes History on Infobox event, never the missing Infobox historical event", () => {
    const text = generateWikitext("history", "Sack of Venceia", {
      historyFields: { date: "1204", location: "Venceia", participants: "", result: "" },
    });

    expect(text).toContain("{{Infobox event");
    expect(text).not.toContain("historical event");
    expect(text).toMatch(/\| name\s+= Sack of Venceia\n/);
    expect(text).toMatch(/\| date\s+= 1204\n/);
    for (const heading of ["Background", "Course", "Aftermath"]) {
      expect(text).toContain(`== ${heading} ==`);
    }
  });

  it("gives a Person the lore headings", () => {
    const text = generateWikitext("person", "Aurelius", {});

    expect(text).toContain("{{Infobox person");
    for (const heading of ["Early life", "Career", "Legacy"]) {
      expect(text).toContain(`== ${heading} ==`);
    }
  });

  it("writes no prose into a lore type's sections", () => {
    for (const type of ["person", "place", "history", "organisation"] as const) {
      expect(generateWikitext(type, "T", {})).not.toMatch(/Write .* here/);
    }
  });

  it("fills missing field groups with empty values", () => {
    expect(generateWikitext("place", "Venceia", {})).toMatch(/\| settlement_type\s+= \n/);
  });
});

describe("generateWikitext categories", () => {
  it("puts the category lines last, one per line, after the body", () => {
    const text = generateWikitext("organisation", "Senate", {}, LORE_CATEGORIES);

    expect(text.endsWith("\n\n[[Category:Caphiria lore]]\n[[Category:Caphiria]]")).toBe(true);
  });

  it("gives a blank page just the category lines", () => {
    expect(generateWikitext("blank", "Senate", {}, LORE_CATEGORIES)).toBe(
      "[[Category:Caphiria lore]]\n[[Category:Caphiria]]"
    );
  });

  it("adds nothing without categories, as before", () => {
    expect(generateWikitext("blank", "Senate", {})).toBe("");
    expect(generateWikitext("blank", "Senate", {}, { categories: [] })).toBe("");
    expect(generateWikitext("person", "Senate", {}).endsWith("<references />")).toBe(true);
  });

  it("drops link and template markup from a category name, and skips one left empty or repeated", () => {
    const text = generateWikitext(
      "blank",
      "Senate",
      {},
      { categories: ["Caph]]iria{{x}}|y", "  ", "[[]]", "Caphiria  ", "Caphiria"] }
    );

    expect(text).toBe("[[Category:Caphiriaxy]]\n[[Category:Caphiria]]");
  });

  it("keeps the other create-page types' templates", () => {
    expect(generateWikitext("company", "Acme", {})).toContain("{{Infobox company");
    expect(generateWikitext("country", "Caphiria", {})).toContain("{{Infobox country");
    expect(generateWikitext("conflict", "War", {})).toContain("{{Infobox military conflict");
    expect(generateWikitext("politics", "Party", {})).toContain("{{Infobox political party");
    expect(generateWikitext("tech", "Wheel", {})).toContain("{{Infobox invention");
  });
});
