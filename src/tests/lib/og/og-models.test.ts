/** @jest-environment node */
/**
 * OG image layout models (`src/lib/og/og-models.ts`): what the passport and realm link-unfurl
 * images print. The passport card uses the page's own wording (nation line, the three facts); a
 * hidden or unknown passport, and a draft or unknown realm, give the generic card with nothing
 * personal on it.
 */
import { describe, expect, it } from "@jest/globals";
import {
  OG_TEXT_MAX,
  clipText,
  guillocheDataUri,
  passportOgModel,
  realmOgModel,
  type PassportOgSource,
} from "~/lib/og/og-models";
import { guillochePaths } from "~/lib/passport/guilloche";
import {
  PASSPORT_GENERIC_DESCRIPTION,
  PASSPORT_TITLE,
  lorewardsLabel,
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

  it("names the holder with their handle, initial and raw avatar", () => {
    const model = passportOgModel(card());
    expect(model).toMatchObject({
      kind: "passport",
      displayName: "Alex Pav",
      handle: "@alex",
      initial: "A",
      avatarUrl: "/images/uploads/alex.png",
    });
  });

  it("prints the nation line as the page does: spaced name, realm and role", () => {
    const model = passportOgModel(card());
    expect(model.kind === "passport" && model.nation).toEqual({
      name: "New Burgundie",
      realm: "Eurth",
      role: "Founder",
      flagUrl: "/images/uploads/flag.png",
    });
  });

  it("leaves a plain member unlabelled and drops the line without a nation", () => {
    const member = passportOgModel(
      card({
        primaryNation: { name: "Kaya", flagUrl: null, realm: { name: "Eurth" }, role: "member" },
      })
    );
    expect(member.kind === "passport" && member.nation?.role).toBeNull();
    const none = passportOgModel(card({ primaryNation: null }));
    expect(none.kind === "passport" && none.nation).toBeNull();
  });

  it("prints the three facts with the page's wording, rank split out for the tint", () => {
    const model = passportOgModel(card());
    expect(model.kind === "passport" && model.stats).toEqual([
      { kind: "lorewards", rank: "#14", text: "Lorewards · 1,247 pts" },
      { kind: "plain", text: "1 realm · 2 nations", muted: false },
      { kind: "plain", text: "Since Oct 2025", muted: true },
    ]);
    // Rank and text together read exactly as the page's label.
    const lorewards = model.kind === "passport" ? model.stats[0] : null;
    expect(lorewards?.kind === "lorewards" && `${lorewards.rank} ${lorewards.text}`).toBe(
      lorewardsLabel(1247, 14)
    );
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

  it("steps the name size down for long names and clips very long ones", () => {
    const size = (displayName: string) => {
      const model = passportOgModel(card({ displayName }));
      return model.kind === "passport" ? model.nameSize : 0;
    };
    expect(size("Alex Pav")).toBeGreaterThan(size("Alexandra Pavlovna-Ivanova"));
    expect(size("Alexandra Pavlovna-Ivanova")).toBeGreaterThan(size("x".repeat(OG_TEXT_MAX.name)));
    const long = passportOgModel(card({ displayName: "y".repeat(80) }));
    expect(long.kind === "passport" && long.displayName.length).toBe(OG_TEXT_MAX.name);
  });

  it("falls back to the handle when the name is blank", () => {
    const model = passportOgModel(card({ displayName: "  " }));
    expect(model).toMatchObject({ displayName: "alex", initial: "A" });
  });
});

describe("realmOgModel", () => {
  const source = {
    name: "Eurth",
    nationCount: 12,
    openCount: 4,
    bannerUrl: "/images/uploads/banner.png",
  };

  it("prints the realm's name, counts and banner with the join call", () => {
    expect(realmOgModel(source)).toEqual({
      kind: "realm",
      name: "Eurth",
      nameSize: 68,
      counts: "12 nations · 4 open to claim",
      bannerUrl: "/images/uploads/banner.png",
      cta: "Join on IxStates",
    });
  });

  it("drops the claim count once nothing is open and the line without nations", () => {
    expect(realmOgModel({ ...source, nationCount: 1, openCount: 0 }).counts).toBe("1 nation");
    expect(realmOgModel({ ...source, nationCount: 0, openCount: 0 }).counts).toBeNull();
  });

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

  it("steps the name size down for long names and clips very long ones", () => {
    const size = (name: string) => realmOgModel({ ...source, name }).nameSize;
    expect(size("Eurth")).toBeGreaterThan(size("The Commonwealth Realms"));
    expect(size("The Commonwealth Realms")).toBeGreaterThan(size("z".repeat(OG_TEXT_MAX.realm)));
    expect(realmOgModel({ ...source, name: "z".repeat(90) }).name.length).toBe(OG_TEXT_MAX.realm);
  });
});

describe("clipText", () => {
  it("keeps short text and cuts long text with an ellipsis", () => {
    expect(clipText("Eurth", 10)).toBe("Eurth");
    expect(clipText("abcdefghij", 5)).toBe("abcd…");
    expect(clipText("  padded  ", 10)).toBe("padded");
  });
});

describe("guillocheDataUri", () => {
  const decode = (uri: string) => atob(uri.replace("data:image/svg+xml;base64,", ""));

  it("draws the page's rosettes as an SVG image satori can size", () => {
    const uri = guillocheDataUri(1000, 500, "#4338ca", 0.12);
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = decode(uri);
    expect(svg).toMatch(/<svg[^>]*viewBox="0 0 1000 500"/);
    expect(svg).toContain('stroke="#4338ca"');
    expect(svg).toContain('stroke-opacity="0.12"');
    expect(svg.match(/<path /g)?.length).toBe(guillochePaths(1000, 500).length);
  });

  it("is deterministic", () => {
    expect(guillocheDataUri(1200, 630, "#000", 0.1)).toBe(guillocheDataUri(1200, 630, "#000", 0.1));
  });
});
