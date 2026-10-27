/** @jest-environment node */
/**
 * A lore piece's type, read from the first infobox of its wikitext when the owner's curation does not name one, and
 * the category every piece of a country carries.
 */
import { loreCategory } from "~/lib/lore/lore-types";
import { inferLoreType } from "~/server/modules/lore/lore.infer";

describe("inferLoreType", () => {
  it.each([
    ["{{Infobox person\n| name = Constantinus I\n}}", "person"],
    ["{{Infobox officeholder|name=Livia}}", "person"],
    ["{{Infobox settlement\n| name = Venceia\n}}", "place"],
    ["{{Infobox event\n| name = The Long Winter\n}}", "event"],
    ["{{Infobox military conflict|conflict=War of the Straits}}", "event"],
    ["{{Infobox organization\n| name = Senate\n}}", "organisation"],
    ["{{Infobox company|name=Ostia Lines}}", "organisation"],
    ["{{Infobox political party|name=Optimates}}", "organisation"],
  ])("reads %j as %s", (wikitext, type) => {
    expect(inferLoreType(wikitext)).toBe(type);
  });

  it("ignores case, underscores and spacing in the template name", () => {
    expect(inferLoreType("{{ infobox_Military  Conflict |x=1}}")).toBe("event");
    expect(inferLoreType("{{INFOBOX PERSON}}")).toBe("person");
  });

  it("takes the first infobox when a page has several", () => {
    expect(inferLoreType("Intro\n{{Infobox settlement}}\n{{Infobox person}}")).toBe("place");
  });

  it("calls an unknown infobox, or a page with none, other", () => {
    expect(inferLoreType("{{Infobox country|name=Caphiria}}")).toBe("other");
    expect(inferLoreType("'''Venceia''' is a city.\n{{Cite web|url=x}}")).toBe("other");
    expect(inferLoreType("")).toBe("other");
  });
});

describe("loreCategory", () => {
  it("names a country's lore category with spaces", () => {
    expect(loreCategory("Caphiria")).toBe("Caphiria lore");
    expect(loreCategory("United_Republic_of_Urcea")).toBe("United Republic of Urcea lore");
  });
});
