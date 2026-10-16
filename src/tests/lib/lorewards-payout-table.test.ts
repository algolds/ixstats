/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import { LOREWARD_PAYOUTS, lorewardBonusKey } from "~/lib/vault/vault-bonus";
import { lorewardNameOf, resolveLorewardUser } from "~/lib/lorewards/resolve-user";

describe("the Loreward payout table", () => {
  it("pays winners more than runner-ups, by contest", () => {
    expect(LOREWARD_PAYOUTS).toEqual({
      daily: { winner: 500, "runner-up": 150 },
      weekly: { winner: 1500, "runner-up": 400 },
      monthly: { winner: 4000, "runner-up": 1000 },
    });
  });

  it("keeps the legacy winner key and gives the runner-up its own", () => {
    expect(lorewardBonusKey("e1", "winner")).toBe("bonus:loreward:e1");
    expect(lorewardBonusKey("e1", "runner-up")).toBe("bonus:loreward:e1:runner-up");
  });
});

interface Revision {
  author: string | null;
  authorId: string | null;
  source: string;
  createdAt: number;
}
interface Link {
  username: string;
  userId: string;
}

const rev = (
  author: string | null,
  authorId: string | null,
  over: Partial<Revision> = {}
): Revision => ({ author, authorId, source: "ixwiki", createdAt: 1, ...over });

/** A database holding these revisions and verified ixwiki links, answering the queries the resolver makes. */
function fakeDb(revisions: Revision[], links: Link[] = []) {
  type LinkWhere = { userId?: string; username?: { equals: string } };
  const linkOf = ({ userId, username }: LinkWhere) =>
    links.find((l) =>
      userId ? l.userId === userId : l.username.toLowerCase() === username?.equals.toLowerCase()
    ) ?? null;
  const authorsUnder = ({ where }: { where: { source: string; author: { in: string[] } } }) => [
    ...new Set(
      revisions
        .filter((r) => r.source === where.source && where.author.in.includes(r.author ?? ""))
        .map((r) => r.authorId)
    ),
  ];
  const latestBy = ({ where }: { where: { authorId: string; source: string } }) =>
    revisions
      .filter((r) => r.authorId === where.authorId && r.source === where.source && r.author)
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  return {
    wikiAccountLink: {
      findFirst: jest.fn(async ({ where }: { where: LinkWhere }) => linkOf(where)),
    },
    wikiRevision: {
      groupBy: jest.fn(async (args: Parameters<typeof authorsUnder>[0]) =>
        authorsUnder(args).map((authorId) => ({ authorId }))
      ),
      findFirst: jest.fn(async (args: Parameters<typeof latestBy>[0]) => {
        const latest = latestBy(args);
        return latest ? { author: latest.author } : null;
      }),
    },
  };
}

describe("resolveLorewardUser", () => {
  it("returns the user of the verified ixwiki link for the normalized name, without reading revisions", async () => {
    const db = fakeDb([rev("Kir_Republic", "u2")], [{ username: "Kir Republic", userId: "u1" }]);
    expect(await resolveLorewardUser(db as never, "Kir_Republic")).toBe("u1");
    expect(db.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: {
        source: "ixwiki",
        verifiedAt: { not: null },
        username: { equals: "Kir Republic", mode: "insensitive" },
      },
      select: { userId: true },
    });
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it("falls back to the one WikiOS account behind every ixwiki edit under the name", async () => {
    const db = fakeDb([rev("Kir_Republic", "u2"), rev("Kir Republic", "u2", { createdAt: 2 })]);
    expect(await resolveLorewardUser(db as never, "Kir_Republic")).toBe("u2");
    expect(db.wikiRevision.groupBy).toHaveBeenCalledWith({
      by: ["authorId"],
      where: { source: "ixwiki", author: { in: ["Kir_Republic", "Kir Republic"] } },
    });
  });

  it("pays no one when an unverified MediaWiki edit carries the same name as a WikiOS account", async () => {
    const db = fakeDb([rev("Ostrozava", null), rev("Ostrozava", "u2", { createdAt: 2 })]);
    expect(await resolveLorewardUser(db as never, "Ostrozava")).toBeNull();
  });

  it("pays no one when two WikiOS accounts have edited under the name", async () => {
    const db = fakeDb([rev("Ostrozava", "u2"), rev("Ostrozava", "u3", { createdAt: 2 })]);
    expect(await resolveLorewardUser(db as never, "Ostrozava")).toBeNull();
  });

  it("ignores edits from other wikis, in both directions", async () => {
    const other = { source: "iiwiki" };
    const shared = fakeDb([rev("Kir Republic", "u3", other), rev("Kir_Republic", "u2")]);
    expect(await resolveLorewardUser(shared as never, "Kir_Republic")).toBe("u2");
    const elsewhere = fakeDb([rev("Kir Republic", "u3", other)]);
    expect(await resolveLorewardUser(elsewhere as never, "Kir_Republic")).toBeNull();
  });

  it("returns null with no verified link and no ixwiki edits", async () => {
    expect(await resolveLorewardUser(fakeDb([]) as never, "Nobody")).toBeNull();
  });
});

describe("lorewardNameOf", () => {
  it("is the verified ixwiki link's name, without reading revisions", async () => {
    const db = fakeDb([rev("Other", "u2")], [{ username: "Kir Republic", userId: "u2" }]);
    expect(await lorewardNameOf(db as never, "u2")).toBe("Kir Republic");
    expect(db.wikiRevision.findFirst).not.toHaveBeenCalled();
  });

  it("is the label of the viewer's latest ixwiki edit when that label resolves to them", async () => {
    const db = fakeDb([
      rev("Old name", "u2"),
      rev("Ostrozava", "u2", { createdAt: 2 }),
      rev("Elsewhere", "u2", { createdAt: 3, source: "iiwiki" }),
    ]);
    expect(await lorewardNameOf(db as never, "u2")).toBe("Ostrozava");
    expect(db.wikiRevision.findFirst).toHaveBeenCalledWith({
      where: { authorId: "u2", source: "ixwiki", author: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { author: true },
    });
  });

  it("is null when the label is shared with an unverified MediaWiki editor", async () => {
    const db = fakeDb([rev("Ostrozava", null), rev("Ostrozava", "u2", { createdAt: 2 })]);
    expect(await lorewardNameOf(db as never, "u2")).toBeNull();
  });

  it("is null when the label is another account's verified link", async () => {
    const db = fakeDb([rev("Ostrozava", "u2")], [{ username: "Ostrozava", userId: "u9" }]);
    expect(await lorewardNameOf(db as never, "u2")).toBeNull();
  });

  it("is null for a viewer with no link and no ixwiki edits", async () => {
    expect(await lorewardNameOf(fakeDb([]) as never, "u2")).toBeNull();
  });
});
