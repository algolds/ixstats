/** @jest-environment node */
/**
 * A coordinates embed in another wiki's article shows the map of the realm whose lore index holds that article,
 * else of the only realm whose lore comes from that wiki; otherwise the viewer's realm.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { realmForWikiArticle } from "~/server/modules/realms/realms.map";

function dbWith(byTitle: string[], byWiki: string[], status = "active") {
  return {
    realmPage: {
      findMany: jest.fn(async ({ where }: { where: { title?: string } }) =>
        (where.title ? byTitle : byWiki).map((realmId) => ({ realmId }))
      ),
    },
    realm: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
        slug: `slug-of-${where.id}`,
        status,
      })),
    },
  };
}

describe("realmForWikiArticle", () => {
  it("gives up when several realms qualify, or the realm is unpublished", async () => {
    await expect(
      realmForWikiArticle(dbWith(["a", "b"], ["a", "b"]) as never, "iiwiki", "X")
    ).resolves.toBeNull();
    await expect(
      realmForWikiArticle(dbWith(["a"], ["a"], "draft") as never, "iiwiki", "X")
    ).resolves.toBeNull();
  });
});
