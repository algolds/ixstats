/** @jest-environment node */
/**
 * A stored link keeps the canonical title it names beside its lower-case slug, so a page that comes to exist turns
 * blue only the links to its exact title ("FOO" is not "Foo"). Links stored before the title was kept match by slug.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { LinkGraphService } from "~/lib/wiki-os/core/link-graph-service";

function makeTx(published: Array<{ id: string; title: string }> = []) {
  return {
    wikiArticle: { findMany: jest.fn().mockResolvedValue(published) },
    wikiLink: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

describe("LinkGraphService.replaceLinks", () => {
  it("stores each target's canonical title beside its slug", async () => {
    const tx = makeTx([{ id: "a-cap", title: "Caphiria" }]);

    await LinkGraphService.replaceLinks(tx as never, "src", "ixwiki", [
      { title: "caphiria" },
      { title: "Treaty_of_Oakhaven" },
    ]);

    expect(tx.wikiLink.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          targetSlug: "caphiria",
          targetTitle: "Caphiria",
          targetArticleId: "a-cap",
        }),
        expect.objectContaining({
          targetSlug: "treaty_of_oakhaven",
          targetTitle: "Treaty of Oakhaven",
          targetArticleId: null,
        }),
      ],
      skipDuplicates: true,
    });
  });
});

describe("LinkGraphService.repointRedLinks", () => {
  it("repoints red links to the exact title, and older links without a title by slug", async () => {
    const tx = makeTx();

    await expect(
      LinkGraphService.repointRedLinks(tx as never, {
        id: "a-foo",
        title: "FOO bar",
        source: "ixwiki",
      })
    ).resolves.toBe(2);

    expect(tx.wikiLink.updateMany).toHaveBeenCalledWith({
      where: {
        targetArticleId: null,
        sourceArticle: { source: "ixwiki" },
        OR: [{ targetTitle: "FOO bar" }, { targetTitle: null, targetSlug: "foo_bar" }],
      },
      data: { targetArticleId: "a-foo" },
    });
  });

  it("repoints nothing for a title MediaWiki would refuse", async () => {
    const tx = makeTx();

    await expect(
      LinkGraphService.repointRedLinks(tx as never, { id: "x", title: "[bad]", source: "ixwiki" })
    ).resolves.toBe(0);
    expect(tx.wikiLink.updateMany).not.toHaveBeenCalled();
  });
});
