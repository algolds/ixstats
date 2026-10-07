import {
  buildPopupTitleNode,
  embedRealm,
  needsWikiRealmLookup,
} from "~/components/maps/widgets/CoordinatesMapEmbed";

describe("buildPopupTitleNode", () => {
  it("renders a wiki-supplied title as text, never as HTML", () => {
    const title = "<img src=x onerror=alert(1)>";
    const node = buildPopupTitleNode(title);

    expect(node.querySelector("img")).toBeNull();
    expect(node.textContent).toBe(title);
  });

  it("keeps the popup styling", () => {
    const node = buildPopupTitleNode("Capital");
    expect(node.style.fontWeight).toBe("bold");
    expect(node.style.fontSize).toBe("12px");
  });
});

describe("embedRealm", () => {
  it("puts an IxWiki article's coordinates on IxWorld's map, whoever reads it", () => {
    expect(embedRealm(undefined, { isWikiPage: true, articleSource: "ixwiki" })).toBe("ixworld");
  });

  it("leaves other wikis' articles and non-article pages to the viewer's realm", () => {
    expect(embedRealm(undefined, { isWikiPage: true, articleSource: "iiwiki" })).toBeUndefined();
    expect(embedRealm(undefined, { isWikiPage: false, articleSource: "ixwiki" })).toBeUndefined();
  });

  it("an explicit realm wins", () => {
    expect(embedRealm("eurth", { isWikiPage: true, articleSource: "ixwiki" })).toBe("eurth");
  });

  it("looks up the realm of another wiki's article, and of nothing else", () => {
    expect(needsWikiRealmLookup(undefined, { isWikiPage: true, articleSource: "iiwiki" })).toBe(
      true
    );
    expect(needsWikiRealmLookup(undefined, { isWikiPage: true, articleSource: "ixwiki" })).toBe(
      false
    );
    expect(needsWikiRealmLookup(undefined, { isWikiPage: false, articleSource: "iiwiki" })).toBe(
      false
    );
    expect(needsWikiRealmLookup("eurth", { isWikiPage: true, articleSource: "iiwiki" })).toBe(
      false
    );
  });
});
