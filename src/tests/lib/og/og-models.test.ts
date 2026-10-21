/** @jest-environment node */
/**
 * OG image layout models (`src/lib/og/og-models.ts`): what the passport and realm link-unfurl
 * images print. The passport card uses the page's own wording (nation line, the three facts); a
 * hidden or unknown passport, and a draft or unknown realm, give the generic card with nothing
 * personal on it.
 */
import { describe, expect, it } from "@jest/globals";
import {
  passportOgModel,
  realmOgModel,
  type PassportOgSource,
} from "~/lib/og/og-models";
import {
  PASSPORT_GENERIC_DESCRIPTION,
  PASSPORT_TITLE
} from "~/lib/passport/passport-labels";

type PreviewCard = Extract<NonNullable<PassportOgSource>, { preview: true }>;

function card(over: Partial<PreviewCard> = {}): PreviewCard {
  return {
    preview: true,
    handle: "alex",
    displayName: "Alex Pav",
    avatarUrl: "/images/uploads/alex.png",
    primaryNation: {
      name: "New_Burgundie",
      flagUrl: "/images/uploads/flag.png",
      realm: { name: "Eurth" },
      role: "founder",
    },
    lorewards: { score: 1247, rank: 14 },
    realmCount: 1,
    nationCount: 2,
    joinedAt: new Date("2025-10-04T12:00:00.000Z"),
    ...over,
  };
}

describe("passportOgModel", () => {
  it("gives the generic card for an unknown handle or previews turned off", () => {
    const generic = {
      kind: "generic",
      title: PASSPORT_TITLE,
      description: PASSPORT_GENERIC_DESCRIPTION,
    };
    expect(passportOgModel(null)).toEqual(generic);
    expect(passportOgModel({ preview: false })).toEqual(generic);
  });
  it("leaves out hidden or unknown facts, never printing a placeholder", () => {
    const model = passportOgModel(
      card({ lorewards: { score: 3, rank: null }, nationCount: 0, joinedAt: null })
    );
    expect(model.kind === "passport" && model.stats).toEqual([
      { kind: "lorewards", rank: null, text: "Lorewards · 3 pts" },
    ]);
    const bare = passportOgModel(card({ lorewards: null, nationCount: 0, joinedAt: null }));
    expect(bare.kind === "passport" && bare.stats).toEqual([]);
  });
});

describe("realmOgModel", () => {
  it("gives the generic card for a draft or unknown realm", () => {
    expect(realmOgModel(null)).toEqual({
      kind: "generic",
      name: "Realms",
      nameSize: 68,
      counts: null,
      bannerUrl: null,
      cta: "Join on IxStates",
    });
  });
});
