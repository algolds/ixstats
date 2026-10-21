/** @jest-environment node */
/**
 * Realm page metadata (`/r/{slug}` link unfurls): the realm's name and a short description from its
 * own description, factbook or tags; no canonical (the realm's pages inherit it). Draft and unknown
 * realms add nothing, so the root defaults stand and nothing about an unpublished realm leaks.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { describe, expect, it } from "@jest/globals";
import {
  loadRealmMetadataSource,
  realmMetadata,
  type RealmMetadataSource,
} from "~/server/modules/realms";
import { createMockPrisma } from "~/tests/helpers/mock-db";

function source(over: Partial<RealmMetadataSource> = {}): RealmMetadataSource {
  return {
    name: "Eurth",
    unlisted: false,
    description: null,
    factbookText: null,
    tags: [],
    nationCount: 12,
    openCount: 4,
    bannerUrl: null,
    ...over,
  };
}

describe("realmMetadata", () => {
  it("sets no canonical or og:url, which every page under the realm would inherit", () => {
    const meta = realmMetadata(source());
    expect(meta).not.toHaveProperty("alternates");
    expect(meta.openGraph).not.toHaveProperty("url");
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
    name: "Eurth",
    status: "active",
    visibility: "public",
    description: "  ",
    factbookHtml: "<p>The <b>Eurth</b> factbook.</p>",
    tags: ["Modern"],
    bannerUrl: " /images/uploads/eurth-banner.png " as string | null,
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

  it("returns null for draft, generating and unknown realms", async () => {
    for (const status of ["draft", "generating"]) {
      const db = dbWith({ ...row, status });
      await expect(loadRealmMetadataSource(db as never, "eurth")).resolves.toBeNull();
      expect(db.country.count).not.toHaveBeenCalled();
    }
    await expect(loadRealmMetadataSource(dbWith(null) as never, "nope")).resolves.toBeNull();
  });
});
