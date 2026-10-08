/** @jest-environment node */
/**
 * `passportMetadata`: what `/@handle` tells link unfurlers (Discord, Slack) and search engines. A
 * card with previews on names the holder and their standing; previews off gives the generic
 * IxStates Passport card; an unknown handle adds nothing but the indexing rule.
 */
import { afterEach, describe, expect, it } from "@jest/globals";
import { lorewardsLabel } from "~/lib/passport/passport-labels";
import { passportMetadata } from "~/server/modules/identity/identity.metadata";
import type { PassportCard } from "~/server/modules/identity/identity.types";

type PreviewCard = Extract<PassportCard, { preview: true }>;

function card(over: Partial<PreviewCard> = {}): PreviewCard {
  return {
    preview: true,
    handle: "alex",
    displayName: "Alex Pav",
    avatarUrl: null,
    primaryNation: {
      name: "Burgundie",
      slug: "burgundie",
      flagUrl: null,
      realm: { name: "Eurth", slug: "eurth" },
      role: "member",
    },
    lorewards: { score: 47, rank: 14 },
    realmCount: 1,
    nationCount: 1,
    joinedAt: new Date("2024-01-01T00:00:00Z"),
    signature: "Personal note",
    bio: "Private bio",
    ...over,
  };
}

const NOINDEX = { index: false, follow: false };
const ORIGINAL_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH;

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = ORIGINAL_BASE_PATH;
});

describe("lorewardsLabel", () => {
  it("words the Lorewards standing as the front face does", () => {
    expect(lorewardsLabel(47, 14)).toBe("#14 Lorewards · 47 pts");
    expect(lorewardsLabel(1250, 1203)).toBe("#1,203 Lorewards · 1,250 pts");
    expect(lorewardsLabel(47, null)).toBe("Lorewards · 47 pts");
  });
});

describe("passportMetadata with link previews on", () => {
  it("titles the page with the display name and handle", () => {
    expect(passportMetadata(card(), true).title).toBe("Alex Pav (@alex) · IxStates Passport");
  });

  it("describes the nation, realm, Lorewards line and holdings", () => {
    expect(passportMetadata(card(), true).description).toBe(
      "Burgundie · Eurth · #14 Lorewards · 47 pts · 1 realm · 1 nation"
    );
  });

  it("skips the parts that are hidden or unknown", () => {
    const meta = passportMetadata(card({ lorewards: null }), true);
    expect(meta.description).toBe("Burgundie · Eurth · 1 realm · 1 nation");
    const bare = passportMetadata(
      card({ primaryNation: null, lorewards: null, realmCount: 0, nationCount: 0 }),
      true
    );
    expect(bare.description).toBe("Alex Pav on IxStates.");
  });

  it("shows nation names with spaces, not wiki underscores", () => {
    const base = card();
    const meta = passportMetadata(
      card({ primaryNation: { ...base.primaryNation!, name: "United_Provinces" } }),
      true
    );
    expect(meta.description).toMatch(/^United Provinces · Eurth/);
  });

  it("points canonical and og:url at /@handle", () => {
    const meta = passportMetadata(card(), true);
    expect(meta.alternates).toEqual({ canonical: "/@alex" });
    expect(meta.openGraph).toMatchObject({ url: "/@alex", type: "profile", username: "alex" });
  });

  it("puts the base path in front of the canonical path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    const meta = passportMetadata(card(), true);
    expect(meta.alternates).toEqual({ canonical: "/projects/ixstates/@alex" });
    expect(meta.openGraph).toMatchObject({ url: "/projects/ixstates/@alex" });
  });

  it("fills og and a large-image twitter card without setting images", () => {
    const meta = passportMetadata(card(), true);
    expect(meta.openGraph).toMatchObject({
      title: "Alex Pav (@alex) · IxStates Passport",
      description: "Burgundie · Eurth · #14 Lorewards · 47 pts · 1 realm · 1 nation",
      siteName: "IxStates",
    });
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      title: "Alex Pav (@alex) · IxStates Passport",
      description: "Burgundie · Eurth · #14 Lorewards · 47 pts · 1 realm · 1 nation",
    });
    expect(meta.openGraph).not.toHaveProperty("images");
  });

  it("keeps the noindex rule when the holder turned indexing off", () => {
    expect(passportMetadata(card(), true).robots).toBeUndefined();
    expect(passportMetadata(card(), false).robots).toEqual(NOINDEX);
  });
});

describe("passportMetadata with link previews off", () => {
  it("gives the generic IxStates Passport card with no personal fields", () => {
    const meta = passportMetadata({ preview: false }, true);
    expect(meta.title).toBe("IxStates Passport");
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "IxStates Passport" });
    expect(meta.alternates).toBeUndefined();
    const text = JSON.stringify(meta);
    for (const personal of ["alex", "Alex Pav", "Burgundie", "Eurth", "Lorewards"]) {
      expect(text).not.toContain(personal);
    }
  });

  it("keeps the noindex rule", () => {
    expect(passportMetadata({ preview: false }, false).robots).toEqual(NOINDEX);
  });
});

describe("passportMetadata for an unknown handle", () => {
  it("adds nothing beyond the indexing rule", () => {
    expect(passportMetadata(null, true)).toEqual({});
    expect(passportMetadata(null, false)).toEqual({ robots: NOINDEX });
  });
});
