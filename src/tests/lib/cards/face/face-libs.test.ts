/** @jest-environment node */
/** The card face's pure parts: labels in enum order, the accessible name, artwork placeholders and the sheet link. */
import { CardFinish, CardRarity, CardType } from "@prisma/client";
import { cardFaceLabel } from "~/lib/cards/face/accessible-name";
import { normalizeArtwork } from "~/lib/cards/face/artwork";
import {
  FINISH_LABEL,
  FINISH_ORDER,
  RARITY_LABEL,
  RARITY_ORDER,
  TYPE_LABEL,
  TYPE_ORDER,
  rarityRank,
} from "~/lib/cards/face/labels";
import { cardSheetHref, encodeSheetFrom, parseSheetFrom } from "~/lib/cards/face/sheet-link";
import type { CardFaceData } from "~/lib/cards/face/types";

const face = (overrides: Partial<CardFaceData> = {}): CardFaceData => ({
  cardId: "c1",
  title: "Caphiria",
  rarity: "EPIC",
  cardType: "LORE",
  realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  artwork: "https://ixwiki.com/images/a.png",
  silhouette: false,
  number: 42,
  season: null,
  isRetired: false,
  copy: { ownershipId: "o1", finish: "FOIL", serialNumber: 3, level: 2 },
  ...overrides,
});

describe("labels", () => {
  it("lists every enum value once, in the schema's order", () => {
    expect([...RARITY_ORDER]).toEqual(Object.values(CardRarity));
    expect([...FINISH_ORDER].sort()).toEqual(Object.values(CardFinish).sort());
    expect([...TYPE_ORDER].sort()).toEqual(Object.values(CardType).sort());
  });

  it("ranks rarities from common to legendary and names them", () => {
    expect(rarityRank("COMMON")).toBe(0);
    expect(rarityRank("ULTRA_RARE")).toBeLessThan(rarityRank("EPIC"));
    expect(rarityRank("LEGENDARY")).toBe(5);
    expect(RARITY_LABEL.ULTRA_RARE).toBe("Ultra Rare");
  });

  it("names every finish and type", () => {
    expect(FINISH_ORDER.map((finish) => FINISH_LABEL[finish])).toEqual([
      "Standard",
      "Foil",
      "Holo",
      "Serialised",
    ]);
    expect(TYPE_ORDER.map((type) => TYPE_LABEL[type])).toEqual([
      "Lore",
      "Nation",
      "NationStates",
      "Special",
      "Trophy",
    ]);
  });
});

describe("cardFaceLabel", () => {
  it("names title, rarity, finish and realm", () => {
    expect(cardFaceLabel(face())).toBe("Caphiria, Epic, Foil, Ixnay");
  });

  it("adds the season for NS and Nation cards, and says when it is not collected or retired", () => {
    expect(
      cardFaceLabel(
        face({
          cardType: "NS",
          season: 3,
          copy: null,
          silhouette: true,
          isRetired: true,
          realm: {
            id: "ns",
            slug: "nationstates",
            name: "NationStates",
            crestUrl: null,
            isSystem: true,
          },
        })
      )
    ).toBe("Caphiria, Epic, NationStates, season 3, not collected, retired");
  });
});

describe("normalizeArtwork", () => {
  it("treats empty values and stored placeholders as no art", () => {
    for (const value of [
      null,
      undefined,
      "",
      "  ",
      "/images/placeholder-flag.svg",
      "/images/cards/lore-placeholder.svg",
      "/default-card-artwork.png",
    ]) {
      expect(normalizeArtwork(value)).toBeNull();
    }
    expect(normalizeArtwork(" https://x/y.png ")).toBe("https://x/y.png");
  });
});

describe("sheet links", () => {
  it("round-trips where a sheet was opened from", () => {
    for (const from of [
      { kind: "showcase", id: "cl_1" },
      { kind: "offer", id: "tr_2" },
      { kind: "holder", handle: "maxim_9" },
      { kind: "holder", handle: "a b" },
      // A passport handle can be a wiki name with spaces, or a Clerk id.
      { kind: "holder", handle: "Takatta Loa" },
      { kind: "holder", handle: "user_2abcDEF345ghiJKL678mnoPQR90s" },
      { kind: "holder", handle: "Mr. Kir" },
    ] as const) {
      expect(parseSheetFrom(encodeSheetFrom(from))).toEqual(from);
    }
  });

  it("carries every passport handle through the address", () => {
    for (const handle of [
      "Takatta Loa",
      "Ostrozava's",
      "Ürceå Ναός 東京",
      "Drunk Uncle Kir\u200e",
      "user_2abcDEF345ghiJKL678mnoPQR90s",
      "x".repeat(255),
    ]) {
      const href = cardSheetHref("/vault/cards/explore", "c1", { kind: "holder", handle });
      const from = new URL(href, "https://ixstates.test").searchParams.get("from");
      expect(parseSheetFrom(from)).toEqual({ kind: "holder", handle });
    }
  });

  it("ignores anything malformed", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "showcase",
      "nope.x",
      "offer.",
      "holder.",
      "xshowcase.a",
      "showcase.a.b",
      "showcase.a b",
      "offer.a'b",
      "Holder.ann",
      "constructor.x",
      "toString.x",
      `showcase.${"x".repeat(65)}`,
      `offer.${"x".repeat(65)}`,
      // A handle holds no control characters and is at most MediaWiki's 255.
      "holder.a\nb",
      "holder.a\tb",
      "holder.a\u0000b",
      "holder.a\u007fb",
      `holder.${"x".repeat(256)}`,
    ]) {
      expect(parseSheetFrom(raw)).toBeNull();
    }
    expect(parseSheetFrom(`showcase.${"x".repeat(64)}`)).toEqual({
      kind: "showcase",
      id: "x".repeat(64),
    });
    // The first dot splits: a handle may hold dots of its own.
    expect(parseSheetFrom("holder.Mr. Kir.")).toEqual({ kind: "holder", handle: "Mr. Kir." });
  });

  it("builds a path that opens the sheet", () => {
    expect(cardSheetHref("/vault/cards/mine", "c 1")).toBe("/vault/cards/mine?card=c+1");
    expect(cardSheetHref("/vault/cards/mine", "c1", null)).toBe("/vault/cards/mine?card=c1");
    expect(cardSheetHref("/vault/cards/explore", "c1", { kind: "holder", handle: "ann" })).toBe(
      "/vault/cards/explore?card=c1&from=holder.ann"
    );
    expect(cardSheetHref("/vault/cards/sets", "c1", { kind: "showcase", id: "cl_1" })).toBe(
      "/vault/cards/sets?card=c1&from=showcase.cl_1"
    );
  });
});
