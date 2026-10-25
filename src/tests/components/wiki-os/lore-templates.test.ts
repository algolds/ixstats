/** @jest-environment node */
/**
 * Native lore plan Task 3: the create-page templates gain Place (`Infobox settlement`) and Organisation
 * (`Infobox organization`), History switches to `Infobox event` (`Infobox historical event` does not exist on
 * ixwiki), each lore type carries its own section headings, and `options.categories` appends category lines.
 */
import { coordinatesFrom, generateWikitext } from "~/lib/wiki-os/create-page/wikitext-templates";

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
          coordinates: { lat: 41.9, lng: 12.5 },
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

  it("writes no coordinates without them, or for ones off the globe", () => {
    const place = (coordinates?: { lat: number; lng: number }) =>
      generateWikitext("place", "Venceia", {
        placeFields: { settlementType: "", subdivision: "", population: "", coordinates },
      });

    expect(place()).toMatch(/\| coordinates\s+= \n/);
    expect(place({ lat: 91, lng: 0 })).toMatch(/\| coordinates\s+= \n/);
    expect(place({ lat: 0, lng: -181 })).toMatch(/\| coordinates\s+= \n/);
    expect(place({ lat: Number.NaN, lng: 0 })).toMatch(/\| coordinates\s+= \n/);
    expect(place({ lat: -90, lng: 180 })).toMatch(/\| coordinates\s+= \{\{coord\|-90\|180\}\}\n/);
  });
});

describe("coordinatesFrom (the generic creator's latitude and longitude inputs)", () => {
  it("is the point when both are numbers on the globe", () => {
    expect(coordinatesFrom("41.9", " 12.5 ")).toEqual({ lat: 41.9, lng: 12.5 });
    expect(coordinatesFrom("0", "0")).toEqual({ lat: 0, lng: 0 });
  });

  it.each([
    ["", "12.5"],
    ["41.9", "  "],
    ["north", "12.5"],
    ["90.1", "0"],
    ["0", "180.5"],
  ])("is none for %j, %j", (lat, lng) => {
    expect(coordinatesFrom(lat, lng)).toBeUndefined();
  });
});

describe("generateWikitext field escaping", () => {
  const PARAM_LINE = /^\| [a-z_]+\s*= /;

  it("escapes a pipe and template braces so the value stays one parameter, intact once rendered", () => {
    const text = generateWikitext("organisation", "Senate", {
      organisationFields: { type: "a|b}} {{x", founded: "", headquarters: "", leader: "" },
    });

    expect(text).toMatch(/\| type\s+= a\{\{!\}\}b&#125;&#125; &#123;&#123;x\n/);
    // the infobox still opens once and closes once, on its own line
    expect(text.match(/\{\{Infobox/g)).toHaveLength(1);
    expect(text.split("\n").filter((line) => line === "}}")).toHaveLength(1);
  });

  it("collapses newlines, so a newline then a pipe cannot start a new parameter", () => {
    const text = generateWikitext("place", "Venceia", {
      placeFields: {
        settlementType: "",
        subdivision: "Latium\n| population_total = 9\r\n|image_skyline=x.png",
        population: "",
      },
    });

    expect(text).toMatch(
      /\| subdivision_name = Latium \{\{!\}\} population_total = 9 \{\{!\}\}image_skyline=x\.png\n/
    );
    const infobox = text.slice(0, text.indexOf("\n}}\n"));
    const params = infobox.split("\n").filter((line) => PARAM_LINE.test(line));
    expect(params.filter((line) => line.startsWith("| population_total"))).toHaveLength(1);
    expect(params.filter((line) => line.startsWith("| image_skyline"))).toHaveLength(1);
  });

  it("escapes every type's fields, and leaves the title as written", () => {
    const text = generateWikitext("person", "Aurelius|II", {
      personFields: { birthDate: "1|2", birthPlace: "}}", nationality: "{{", occupation: "a\nb" },
    });

    expect(text).toMatch(/\| name\s+= Aurelius\|II\n/);
    expect(text).toMatch(/\| birth_date\s+= 1\{\{!\}\}2\n/);
    expect(text).toMatch(/\| birth_place\s+= &#125;&#125;\n/);
    expect(text).toMatch(/\| nationality\s+= &#123;&#123;\n/);
    expect(text).toMatch(/\| occupation\s+= a b\n/);
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

  it("drops a section anchor and tag brackets from a category name", () => {
    expect(generateWikitext("blank", "Senate", {}, { categories: ["Caph#iria<b>lore</b>"] })).toBe(
      "[[Category:Caphiriablore/b]]"
    );
  });

  it("keeps the other create-page types' templates", () => {
    expect(generateWikitext("company", "Acme", {})).toContain("{{Infobox company");
    expect(generateWikitext("country", "Caphiria", {})).toContain("{{Infobox country");
    expect(generateWikitext("conflict", "War", {})).toContain("{{Infobox military conflict");
    expect(generateWikitext("politics", "Party", {})).toContain("{{Infobox political party");
    expect(generateWikitext("tech", "Wheel", {})).toContain("{{Infobox invention");
  });
});
