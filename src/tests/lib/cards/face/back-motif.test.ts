import { backMotif } from "~/lib/cards/face/back-motif";
import { CATEGORY_ICONS } from "~/lib/cards/face/category-icons";
import { IIWIKI_LOGO_URL, NATIONSTATES_LOGO_URL } from "~/lib/cards/realm-logos";

const realm = (slug: string, name = "Eurth", crestUrl: string | null = null) => ({
  slug,
  name,
  crestUrl,
});

describe("backMotif", () => {
  it("repeats the card's category when it has one, whatever its realm", () => {
    expect(backMotif("HISTORY", realm("nationstates"))).toEqual({
      kind: "path",
      viewBox: CATEGORY_ICONS.HISTORY.viewBox,
      d: CATEGORY_ICONS.HISTORY.path,
    });
  });

  it("falls back to the realm's mark: the Ix logo for Ixnay and for an unseen card", () => {
    expect(backMotif(null, realm("ixnay"))).toEqual({ kind: "image", href: "/images/ix-logo.svg" });
    expect(backMotif(null, realm("default"))).toEqual({
      kind: "image",
      href: "/images/ix-logo.svg",
    });
    expect(backMotif(null, null)).toEqual({ kind: "image", href: "/images/ix-logo.svg" });
  });

  it("uses the NationStates and IIWiki logos for those realms", () => {
    expect(backMotif(null, realm("nationstates"))).toEqual({
      kind: "image",
      href: NATIONSTATES_LOGO_URL,
    });
    expect(backMotif(null, realm("iiwiki"))).toEqual({ kind: "image", href: IIWIKI_LOGO_URL });
  });

  it("uses a realm's own emblem, through the image proxy, and else its initial", () => {
    expect(backMotif(null, realm("eurth", "Eurth", "https://example.org/e.png"))).toEqual({
      kind: "image",
      href: expect.stringContaining("e.png"),
    });
    expect(backMotif(null, realm("eurth", "eurth"))).toEqual({ kind: "initial", letter: "E" });
  });
});
