/**
 * The Lore tab's pure parts: pieces grouped by type in a fixed order (empty groups left out), each piece's chapter
 * anchor, a refusal the owner can act on shown in the server's words, and a piece's ids and headings made its own as a
 * chapter (its links under the base path are WikiOS's `withAppHrefs`, in src/tests/lib/wiki-os/reader-hrefs.test.ts).
 */
import { groupLorePieces, loreChapterId, LORE_GROUP_LABEL } from "~/lib/lore/lore-groups";
import { eventSeed, placeSeed } from "~/lib/lore/lore-seeds";
import { scopeArticleIds, shiftArticleHeadings } from "~/lib/lore/piece-html";
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

  it("holds no character that needs escaping in an attribute or a fragment", () => {
    expect(loreChapterId('Ünion "Day" <1> & #2 50%')).toBe(
      "lore-piece-.C3.9Cnion_.22Day.22_.3C1.3E_.26_.232_50.25"
    );
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

describe("scopeArticleIds", () => {
  it("prefixes ids and the fragment links that point at them, so a footnote finds its own note", () => {
    const html =
      '<p>Text<sup id="cite_ref-1" class="reference"><a href="#cite_note-1">[1]</a></sup></p>' +
      '<ol class="references"><li id="cite_note-1"><a href="#cite_ref-1">^</a> A note.</li></ol>';
    expect(scopeArticleIds(html, "lore-piece-Venceia")).toBe(
      '<p>Text<sup id="lore-piece-Venceia:cite_ref-1" class="reference"><a href="#lore-piece-Venceia:cite_note-1">[1]</a></sup></p>' +
        '<ol class="references"><li id="lore-piece-Venceia:cite_note-1"><a href="#lore-piece-Venceia:cite_ref-1">^</a> A note.</li></ol>'
    );
  });

  it("prefixes every id an aria reference names", () => {
    const html =
      '<div aria-describedby="a b" aria-labelledby="c" aria-controls="d" aria-owns="e"></div>';
    expect(scopeArticleIds(html, "s")).toBe(
      '<div aria-describedby="s:a s:b" aria-labelledby="s:c" aria-controls="s:d" aria-owns="s:e"></div>'
    );
  });

  it("reads an aria reference's ids however they are spaced", () => {
    expect(scopeArticleIds('<i aria-labelledby=" c \td "></i>', "s")).toBe(
      '<i aria-labelledby="s:c s:d"></i>'
    );
  });

  it("reads attribute names in any case", () => {
    expect(scopeArticleIds('<B ID="x" ARIA-LABELLEDBY="y"><A HREF="#x">a</A></B>', "s")).toBe(
      '<B ID="s:x" ARIA-LABELLEDBY="s:y"><A HREF="#s:x">a</A></B>'
    );
  });

  it("leaves other links, an empty fragment, look-alike attributes and text alone", () => {
    const html =
      '<a href="/wiki/A#History">a</a><a href="#">b</a><span data-id="x" grid="y">id="z" href="#q"</span>';
    expect(scopeArticleIds(html, "s")).toBe(html);
  });

  it("escapes a prefix that would break out of the attribute", () => {
    expect(scopeArticleIds('<b id="x"></b>', 'p"<&')).toBe('<b id="p&quot;&lt;&amp;:x"></b>');
  });

  const idsOf = (html: string) => [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1]);

  it("never gives two pieces the same id when a title holds a hyphen", () => {
    // "Senate" with a section "History" against a piece titled "Senate-History" with a section "History".
    const senate = scopeArticleIds('<h2 id="History">History</h2>', loreChapterId("Senate"));
    const hyphenated = scopeArticleIds(
      '<h2 id="History">History</h2>',
      loreChapterId("Senate-History")
    );
    const chapterIds = [loreChapterId("Senate"), loreChapterId("Senate-History")];
    const all = [...idsOf(senate), ...idsOf(hyphenated), ...chapterIds];
    expect(new Set(all).size).toBe(all.length);
  });

  it("never gives a section the id of the chapter's own heading", () => {
    const chapter = loreChapterId("Senate");
    const [section] = idsOf(scopeArticleIds('<h2 id="heading">Heading</h2>', chapter));
    expect(section).not.toBe(`${chapter}-heading`);
  });

  it("keeps the separator out of every chapter id, so a prefix ends where the separator starts", () => {
    expect(loreChapterId("Note: a:b")).not.toContain(":");
  });
});

describe("shiftArticleHeadings", () => {
  it("moves each heading down two levels, to sit under a piece's h3 title, and stops at h6", () => {
    const html =
      '<h2 id="Early_life">Early life</h2><h3>Youth</h3><h4>a</h4><h5>b</h5><h6 class="x">c</h6>';
    expect(shiftArticleHeadings(html)).toBe(
      '<h4 id="Early_life">Early life</h4><h5>Youth</h5><h6>a</h6><h6>b</h6><h6 class="x">c</h6>'
    );
    expect(shiftArticleHeadings("<H1>Top</H1>")).toBe("<h3>Top</h3>");
  });

  it("leaves other tags and text alone", () => {
    const html = "<hr><header>x</header><h2o>y</h2o><p>h2 and &lt;h2&gt;</p>";
    expect(shiftArticleHeadings(html)).toBe(html);
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
