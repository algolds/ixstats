import { cleanName, cleanCorpus } from "./clean";

describe("cleanName", () => {
  test("strips parenthetical disambiguation", () => {
    expect(cleanName("Sydalon (city)", "city")).toBe("Sydalon");
    expect(cleanName("Belau (1983: Doomsday)", "country")).toBe("Belau");
    expect(cleanName("Japan (Central Victory)", "country")).toBe("Japan");
  });

  test("drops comma qualifier tails", () => {
    expect(cleanName("Castelle County, Verona", "city")).toBe("Castelle County");
  });

  test("strips double-quotes but keeps intra-word apostrophes", () => {
    expect(cleanName('"Allas Project"', "organization")).toBe("Allas Project");
    expect(cleanName("Patrick's Town", "city")).toBe("Patrick's Town");
    expect(cleanName("West T'kampa", "city")).toBe("West T'kampa");
    expect(cleanName("O'Connor", "person")).toBe("O'Connor");
    expect(cleanName('"Survivor Joe" Navarra', "person")).toBe("Survivor Joe Navarra");
  });

  test("country: removes governmental descriptor prefix", () => {
    expect(cleanName("Republic of Nasastan", "country")).toBe("Nasastan");
    expect(cleanName("Kingdom of Belgium", "country")).toBe("Belgium");
    expect(cleanName("Federal Republic of Whatever", "country")).toBe("Whatever");
  });

  test("person: strips regnal numerals and territorial suffix", () => {
    expect(cleanName("Rhys I of Faneria", "person")).toBe("Rhys");
    expect(cleanName("Sean II Suthar-Màrtainn", "person")).toBe("Sean Suthar-Màrtainn");
    expect(cleanName("David Roth", "person")).toBe("David Roth");
  });

  test("does NOT strip 'of' for non-person categories", () => {
    expect(cleanName("Isle of Man", "city")).toBe("Isle of Man");
  });

  test("rejects colons and structural filler words", () => {
    expect(cleanName("Category:Stub pages", "city")).toBeNull();
    expect(cleanName("Draft:Nasastan", "city")).toBeNull();
    expect(cleanName("Timeline of Fanerian Monarchs", "city")).toBeNull();
    expect(cleanName("List of countries", "city")).toBeNull();
    expect(cleanName("A and B", "city")).toBeNull();
    expect(cleanName("The Empire", "city")).toBeNull();
  });

  test("rejects administrative conworld suffixes", () => {
    expect(cleanName("Nasastan Football Association", "organization")).toBeNull();
    expect(cleanName("Socialist Party", "organization")).toBeNull();
    expect(cleanName("Workers Union", "organization")).toBeNull();
  });

  test("person: strips title prefixes", () => {
    expect(cleanName("King David", "person")).toBe("David");
    expect(cleanName("Queen Elizabeth II", "person")).toBe("Elizabeth");
    expect(cleanName("Sir General John", "person")).toBe("John");
  });

  test("rejects junk", () => {
    expect(cleanName("1607-1860", "country")).toBeNull();
    expect(cleanName("", "city")).toBeNull();
    expect(cleanName("X", "city")).toBeNull();
    expect(cleanName("A very long list of all the things in the world", "city")).toBeNull();
  });
});

describe("cleanCorpus", () => {
  test("dedups case-insensitively within a category, keeps cross-category", () => {
    const out = cleanCorpus([
      { name: "Roma", category: "city", sourceWiki: "ixwiki" },
      { name: "roma", category: "city", sourceWiki: "iiwiki" },
      { name: "Roma", category: "person", sourceWiki: "ixwiki" },
      { name: "Sydalon (city)", category: "city", sourceWiki: "iiwiki" },
    ]);
    expect(out.map((r) => `${r.category}:${r.name}`).sort()).toEqual([
      "city:Roma",
      "city:Sydalon",
      "person:Roma",
    ]);
  });
});
