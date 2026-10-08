/** @jest-environment node */
/**
 * Realm page metadata (`/r/{slug}` link unfurls): the realm's name, a short description from its own
 * description, factbook or tags, and a canonical `/r/{slug}`. Draft and unknown realms add nothing,
 * so the root defaults stand and nothing about an unpublished realm leaks.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { afterEach, describe, expect, it } from "@jest/globals";
import {
  loadRealmMetadataSource,
  realmMetadata,
  type RealmMetadataSource,
} from "~/server/modules/realms";
import { createMockPrisma } from "~/tests/helpers/mock-db";

function source(over: Partial<RealmMetadataSource> = {}): RealmMetadataSource {
  return {
    slug: "eurth",
    name: "Eurth",
    unlisted: false,
    description: null,
    factbookText: null,
    tags: [],
    nationCount: 12,
    openCount: 4,
    ...over,
  };
}

const ORIGINAL_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH;

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = ORIGINAL_BASE_PATH;
});

describe("realmMetadata", () => {
  it("titles the page with the realm name and points canonical at /r/{slug}", () => {
    const meta = realmMetadata(source());
    expect(meta.title).toBe("Eurth");
    expect(meta.alternates).toEqual({ canonical: "/r/eurth" });
    expect(meta.openGraph).toMatchObject({
      title: "Eurth",
      url: "/r/eurth",
      siteName: "IxStates",
      type: "website",
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "Eurth" });
    expect(meta.openGraph).not.toHaveProperty("images");
  });

  it("puts the base path in front of the canonical path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    expect(realmMetadata(source()).alternates).toEqual({ canonical: "/projects/ixstates/r/eurth" });
  });

  it("prefers the realm's own description", () => {
    const meta = realmMetadata(
      source({ description: "A modern world.", factbookText: "Long factbook", tags: ["Modern"] })
    );
    expect(meta.description).toBe("A modern world.");
    expect(meta.twitter).toMatchObject({ description: "A modern world." });
  });

  it("falls back to the factbook, cut short at a word", () => {
    const factbookText = `${"word ".repeat(60)}end`;
    const description = realmMetadata(source({ factbookText })).description ?? "";
    expect(description.length).toBeLessThanOrEqual(161);
    expect(description.endsWith("word…")).toBe(true);
  });

  it("falls back to the tags, then to the nation counts", () => {
    expect(realmMetadata(source({ tags: ["Modern", "Diplomacy"] })).description).toBe(
      "Modern, Diplomacy"
    );
    expect(realmMetadata(source()).description).toBe("12 nations · 4 open to claim");
    expect(realmMetadata(source({ nationCount: 1, openCount: 0 })).description).toBe("1 nation");
    expect(realmMetadata(source({ nationCount: 0, openCount: 0 })).description).toBeUndefined();
  });

  it("keeps an unlisted realm out of search results but still unfurls it", () => {
    expect(realmMetadata(source()).robots).toBeUndefined();
    const meta = realmMetadata(source({ unlisted: true }));
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.title).toBe("Eurth");
  });

  it("adds nothing for a draft or unknown realm", () => {
    expect(realmMetadata(null)).toEqual({});
  });
});

describe("loadRealmMetadataSource", () => {
  const row = {
    id: "r1",
    slug: "eurth",
    name: "Eurth",
    status: "active",
    visibility: "public",
    description: "  ",
    factbookHtml: "<p>The <b>Eurth</b> factbook.</p>",
    tags: ["Modern"],
  };

  type RealmRow = typeof row;

  function dbWith(realm: RealmRow | null, nations = 12, claimed = 8) {
    const db = createMockPrisma();
    db.realm.findUnique.mockResolvedValue(realm);
    db.country.count.mockImplementation(
      async ({ where }: { where: { ownerUserId?: { not: null } } }) =>
        where.ownerUserId ? claimed : nations
    );
    return db;
  }

  it("loads the realm's text and counts for an active realm", async () => {
    const db = dbWith(row);
    await expect(loadRealmMetadataSource(db as never, "eurth")).resolves.toEqual({
      slug: "eurth",
      name: "Eurth",
      unlisted: false,
      description: null,
      factbookText: "The Eurth factbook.",
      tags: ["Modern"],
      nationCount: 12,
      openCount: 4,
    });
    expect(db.realm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "eurth" } })
    );
  });

  it("counts no open nations for an archived realm and flags unlisted ones", async () => {
    const db = dbWith({ ...row, status: "archived", visibility: "unlisted" });
    await expect(loadRealmMetadataSource(db as never, "eurth")).resolves.toMatchObject({
      unlisted: true,
      openCount: 0,
    });
  });

  it("returns null for draft, generating and unknown realms", async () => {
    for (const status of ["draft", "generating"]) {
      const db = dbWith({ ...row, status });
      await expect(loadRealmMetadataSource(db as never, "eurth")).resolves.toBeNull();
      expect(db.country.count).not.toHaveBeenCalled();
    }
    await expect(loadRealmMetadataSource(dbWith(null) as never, "nope")).resolves.toBeNull();
  });
});
