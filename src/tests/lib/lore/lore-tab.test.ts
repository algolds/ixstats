/**
 * The Lore tab's pure parts: pieces grouped by type in a fixed order (empty groups left out), each piece's chapter
 * anchor, a refusal the owner can act on shown in the server's words, and a piece's links kept under the deployment's
 * base path.
 */
import { groupLorePieces, loreChapterId, LORE_GROUP_LABEL } from "~/lib/lore/lore-groups";
import { eventSeed, placeSeed } from "~/lib/lore/lore-seeds";
import { linksUnderBasePath } from "~/lib/lore/piece-links";
import { refusalMessage } from "~/lib/lore/writer-messages";

const piece = (title: string, type: "person" | "place" | "event" | "organisation" | "other") => ({
  title,
  type,
  pinned: false,
});

describe("groupLorePieces", () => {
  it("groups People, Places, Events, Organisations, then Other, leaving out empty groups", () => {
    const groups = groupLorePieces([
      piece("Senate", "organisation"),
      piece("Venceia", "place"),
      piece("Odd", "other"),
      piece("Constantinus I", "person"),
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      "People",
      "Places",
      "Organisations",
      "Other",
    ]);
    expect(groups.map((group) => group.type)).toEqual(["person", "place", "organisation", "other"]);
  });

  it("keeps the order the list gave within a group (pinned first, from the server)", () => {
    const [people] = groupLorePieces([
      { ...piece("Zeno", "person"), pinned: true },
      piece("Aurelia", "person"),
    ]);
    expect(people?.pieces.map((p) => p.title)).toEqual(["Zeno", "Aurelia"]);
  });

  it("returns no groups for no pieces", () => {
    expect(groupLorePieces([])).toEqual([]);
  });

  it("names every type's group", () => {
    expect(LORE_GROUP_LABEL).toEqual({
      person: "People",
      place: "Places",
      event: "Events",
      organisation: "Organisations",
      other: "Other",
    });
  });
});

describe("loreChapterId", () => {
  it("is a stable id without spaces, apart from the article's own heading ids", () => {
    expect(loreChapterId("Senate of Caphiria")).toBe("lore-piece-Senate_of_Caphiria");
    expect(loreChapterId("A  b\tc")).toBe("lore-piece-A_b_c");
  });
});

describe("refusalMessage", () => {
  const refusal = (code: string, message: string) =>
    Object.assign(new Error(message), { data: { code } });

  it("shows the server's sentence for a refusal the owner can act on", () => {
    for (const code of ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND", "TOO_MANY_REQUESTS", "CONFLICT"]) {
      expect(refusalMessage(refusal(code, "They are already on the lore team."), "Generic")).toBe(
        "They are already on the lore team."
      );
    }
  });

  it("says the fallback for anything else, so no server detail leaks", () => {
    expect(refusalMessage(refusal("INTERNAL_SERVER_ERROR", "db exploded"), "Generic")).toBe(
      "Generic"
    );
    expect(refusalMessage(new Error("network"), "Generic")).toBe("Generic");
  });
});

describe("linksUnderBasePath", () => {
  it("puts the base path on a root-relative link", () => {
    expect(
      linksUnderBasePath('<p><a href="/wiki/Venceia" title="Venceia">V</a></p>', "/projects/x")
    ).toBe('<p><a href="/projects/x/wiki/Venceia" title="Venceia">V</a></p>');
    expect(linksUnderBasePath('<a class="c" href="/countries/caphiria">C</a>', "/p")).toBe(
      '<a class="c" href="/p/countries/caphiria">C</a>'
    );
  });

  it("leaves a link that already has it, an absolute, protocol-relative, anchor or MediaWiki file link", () => {
    const html = [
      '<a href="/p/wiki/A">a</a>',
      '<a href="/p">b</a>',
      '<a href="https://iiwiki.com/wiki/B">c</a>',
      '<a href="//example.com/x">d</a>',
      '<a href="#History">e</a>',
      '<a href="/images/a/ab/File.png">f</a>',
      '<a href="/w/index.php?title=X">g</a>',
    ].join("");
    expect(linksUnderBasePath(html, "/p")).toBe(html);
  });

  it("does not touch a base path that merely starts the same way", () => {
    expect(linksUnderBasePath('<a href="/projects/xyz">a</a>', "/projects/x")).toBe(
      '<a href="/projects/x/projects/xyz">a</a>'
    );
  });

  it("touches only links, never text that looks like an attribute", () => {
    const html = '<p>write href="/wiki/A" like this</p><img src="/images/x.png">';
    expect(linksUnderBasePath(html, "/p")).toBe(html);
  });

  it("changes nothing without a base path", () => {
    const html = '<a href="/wiki/A">a</a>';
    expect(linksUnderBasePath(html, "")).toBe(html);
  });
});

describe("entry point seeds", () => {
  it("seeds a region as a Place with its title only", () => {
    expect(placeSeed("Inosia")).toEqual({ type: "place", title: "Inosia" });
  });

  it("seeds a city or pin with its point, and its region when known", () => {
    expect(placeSeed("Venceia", [12.5, 41.9], "Carina")).toStrictEqual({
      type: "place",
      title: "Venceia",
      place: { lng: 12.5, lat: 41.9, subdivision: "Carina" },
    });
    expect(placeSeed("The founding", [12, 41])).toStrictEqual({
      type: "place",
      title: "The founding",
      place: { lng: 12, lat: 41 },
    });
  });

  it("seeds a History entry as an Event with its date", () => {
    expect(eventSeed("Kingdom founded", "480 BC")).toEqual({
      type: "event",
      title: "Kingdom founded",
      date: "480 BC",
    });
  });
});
