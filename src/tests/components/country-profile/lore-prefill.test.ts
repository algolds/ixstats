/**
 * The lore writer's starting text: the type's ixwiki template (Event writes the history template, Other only the
 * category lines), filled from the form and its seed, with the country's lore category and its own category.
 */
import {
  EMPTY_LORE_FIELDS,
  LORE_PAGE_TYPE,
  lorePrefill,
  seedLoreFields,
} from "~/components/country-profile/lore/writer/lore-prefill";

describe("LORE_PAGE_TYPE", () => {
  it("maps each lore type to the create flow's template", () => {
    expect(LORE_PAGE_TYPE).toEqual({
      person: "person",
      place: "place",
      event: "history",
      organisation: "organisation",
      other: "blank",
    });
  });
});

describe("seedLoreFields", () => {
  it("is empty without a seed", () => {
    expect(seedLoreFields(undefined)).toEqual(EMPTY_LORE_FIELDS);
  });

  it("puts a seeded place's point and subdivision on the Place form", () => {
    const fields = seedLoreFields({ place: { lat: 41.9, lng: 12.5, subdivision: "Latium" } });
    expect(fields.place).toEqual({
      ...EMPTY_LORE_FIELDS.place,
      subdivision: "Latium",
      coordinates: { lat: 41.9, lng: 12.5 },
    });
  });

  it("leaves the subdivision empty for a place seeded without one", () => {
    expect(seedLoreFields({ place: { lat: 1, lng: 2 } }).place.subdivision).toBe("");
  });

  it("puts a seeded date on the Event form", () => {
    expect(seedLoreFields({ date: "1012" }).event).toEqual({
      ...EMPTY_LORE_FIELDS.event,
      date: "1012",
    });
  });
});

describe("lorePrefill", () => {
  it("writes a Place with its settlement infobox, point and both categories", () => {
    const fields = seedLoreFields({ place: { lat: 41.9, lng: 12.5, subdivision: "Latium" } });
    const text = lorePrefill("place", "Venceia", fields, "Caphiria");
    expect(text).toContain("{{Infobox settlement");
    expect(text).toContain("{{coord|41.9|12.5}}");
    expect(text).toContain("Latium");
    expect(text).toContain("== History ==");
    expect(text.endsWith("[[Category:Caphiria lore]]\n[[Category:Caphiria]]")).toBe(true);
  });

  it("writes an Event with the event infobox and its date", () => {
    const text = lorePrefill(
      "event",
      "Treaty of Venceia",
      seedLoreFields({ date: "1012" }),
      "Caphiria"
    );
    expect(text).toContain("{{Infobox event");
    expect(text).toMatch(/\| date\s*= 1012/);
    expect(text).toContain("== Background ==");
  });

  it("writes a Person and an Organisation with their own infoboxes", () => {
    const fields = {
      ...EMPTY_LORE_FIELDS,
      person: { ...EMPTY_LORE_FIELDS.person, occupation: "Consul" },
      organisation: { ...EMPTY_LORE_FIELDS.organisation, founded: "980" },
    };
    expect(lorePrefill("person", "Marcus", fields, "Caphiria")).toMatch(
      /\{\{Infobox person[\s\S]*Consul/
    );
    expect(lorePrefill("organisation", "Senate", fields, "Caphiria")).toMatch(
      /\{\{Infobox organization[\s\S]*980/
    );
  });

  it("writes only the category lines for Other", () => {
    expect(lorePrefill("other", "Notes", EMPTY_LORE_FIELDS, "Caphiria")).toBe(
      "[[Category:Caphiria lore]]\n[[Category:Caphiria]]"
    );
  });

  it("names the categories with spaces for a country whose name has underscores", () => {
    expect(lorePrefill("other", "Notes", EMPTY_LORE_FIELDS, "United_Republic")).toBe(
      "[[Category:United Republic lore]]\n[[Category:United Republic]]"
    );
  });
});
