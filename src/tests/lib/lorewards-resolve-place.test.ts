/** @jest-environment node */
/**
 * Who a Loreward place pays. The bot scores MediaWiki, where an unlinked WikiOS author's edits arrive as
 * `wikios>Label` (a name no MediaWiki account can hold) and every other name is a MediaWiki account, or a linked
 * WikiOS user mirrored under it. A plain name pays only the account holding its exact APPROVED name claim (hidden or
 * shown: a payout is not a display). A `wikios>` name pays the one WikiOS account behind the label's edits to the
 * winning page inside the contest. A claim never applies to it.
 */
import { describe, it, expect } from "@jest/globals";
import {
  resolveLorewardPlace,
  scoredEditsAccount,
  type LorewardPlaceRef,
} from "~/lib/lorewards/resolve-user";

interface Revision {
  author: string;
  authorId: string | null;
  source: string;
  createdAt: string;
  page: string;
  /** The revision sits on a redirect article (a page moved away from this title). */
  redirect: boolean;
}
interface Claim {
  name: string;
  userId: string;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  visible?: boolean;
}
interface ClaimWhere {
  source: string;
  name: string;
  status: string;
  visible?: boolean;
}
interface RevisionWhere {
  source: string;
  author: string;
  createdAt: { gte: Date; lt: Date };
  article: { source: string; title: string; redirectTargetSlug: null };
}

const rev = (authorId: string | null, over: Partial<Revision> = {}): Revision => ({
  author: "Kir Republic",
  authorId,
  source: "ixwiki",
  createdAt: "2026-10-16T12:00:00.000Z",
  page: "Seneca front",
  redirect: false,
  ...over,
});

const matches = (r: Revision, where: RevisionWhere) => {
  const at = new Date(r.createdAt);
  return (
    r.source === where.source &&
    r.author === where.author &&
    at >= where.createdAt.gte &&
    at < where.createdAt.lt &&
    where.article.source === "ixwiki" &&
    r.page === where.article.title &&
    !r.redirect &&
    where.article.redirectTargetSlug === null
  );
};

const claimMatches = (c: Claim, where: ClaimWhere) =>
  where.source === "ixwiki" &&
  c.name === where.name &&
  (c.status ?? "APPROVED") === where.status &&
  (where.visible === undefined || (c.visible ?? true) === where.visible);

/** A database holding these revisions and ixwiki name claims, answering the queries the resolver makes. */
function fakeDb(revisions: Revision[], claims: Claim[] = []) {
  return {
    wikiNameClaim: {
      findFirst: jest.fn(async ({ where }: { where: ClaimWhere; select?: object }) => {
        const claim = claims.find((c) => claimMatches(c, where));
        return claim ? { userId: claim.userId } : null;
      }),
    },
    wikiRevision: {
      groupBy: jest.fn(async ({ where }: { by?: string[]; where: RevisionWhere }) =>
        [...new Set(revisions.filter((r) => matches(r, where)).map((r) => r.authorId))].map(
          (authorId) => ({ authorId })
        )
      ),
    },
  };
}

const daily = (over: Partial<LorewardPlaceRef> = {}): LorewardPlaceRef => ({
  wikiUser: "wikios>Kir Republic",
  page: "Seneca front",
  type: "daily",
  date: "2026-10-16",
  dateStart: null,
  dateEnd: null,
  ...over,
});

describe("resolveLorewardPlace, a plain (MediaWiki) name", () => {
  it("pays the approved claim's owner of the normalized name, without reading revisions", async () => {
    const db = fakeDb([rev("u2")], [{ name: "Kir Republic", userId: "u1" }]);
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "Kir_Republic" }))).toBe("u1");
    expect(db.wikiNameClaim.findFirst).toHaveBeenCalledWith({
      where: { source: "ixwiki", name: "Kir Republic", status: "APPROVED" },
      select: { userId: true },
    });
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it("pays no one without a claim, even with WikiOS edits under that name on the page", async () => {
    const db = fakeDb([rev("u2"), rev("u2", { createdAt: "2026-10-16T18:00:00.000Z" })]);
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "Kir Republic" }))).toBeNull();
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it.each(["PENDING", "REJECTED", "REVOKED"] as const)(
    "pays no one for a %s claim on the name",
    async (status) => {
      const db = fakeDb([], [{ name: "Kir Republic", userId: "u1", status }]);
      expect(
        await resolveLorewardPlace(db as never, daily({ wikiUser: "Kir Republic" }))
      ).toBeNull();
    }
  );

  it("pays the owner of an approved claim they keep hidden: a payout is not a display", async () => {
    const db = fakeDb([], [{ name: "Kir Republic", userId: "u1", visible: false }]);
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "Kir Republic" }))).toBe("u1");
  });

  it("pays the approved holder, not a revoked earlier holder of the same name", async () => {
    const db = fakeDb(
      [],
      [
        { name: "Kir Republic", userId: "u_wrong", status: "REVOKED" },
        { name: "Kir Republic", userId: "u_right" },
      ]
    );
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "Kir Republic" }))).toBe(
      "u_right"
    );
  });

  it("does not match a claim that differs in case after the first letter", async () => {
    // MediaWiki usernames are case-sensitive after the first letter: "OstroZava" is another account.
    const db = fakeDb([], [{ name: "Ostrozava", userId: "u9" }]);
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "OstroZava" }))).toBeNull();
    const other = fakeDb([], [{ name: "OstroZava", userId: "u9" }]);
    expect(await resolveLorewardPlace(other as never, daily({ wikiUser: "Ostrozava" }))).toBeNull();
  });
});

describe("resolveLorewardPlace, a wikios> name", () => {
  it("pays the one WikiOS account behind the label's edits to the page in the contest", async () => {
    const db = fakeDb([rev("u2"), rev("u2", { createdAt: "2026-10-16T23:59:00.000Z" })]);
    expect(await resolveLorewardPlace(db as never, daily())).toBe("u2");
    expect(db.wikiRevision.groupBy).toHaveBeenCalledWith({
      by: ["authorId"],
      where: {
        source: "ixwiki",
        author: "Kir Republic",
        createdAt: {
          gte: new Date("2026-10-16T00:00:00.000Z"),
          lt: new Date("2026-10-17T06:00:00.000Z"),
        },
        article: { source: "ixwiki", title: "Seneca front", redirectTargetSlug: null },
      },
    });
  });

  it("counts an edit at 01:00Z the next day: the bot's day is US Eastern", async () => {
    const db = fakeDb([rev("u2", { createdAt: "2026-10-17T01:00:00.000Z" })]);
    expect(await resolveLorewardPlace(db as never, daily())).toBe("u2");
  });

  it("leaves out edits from 06:00Z the next day on", async () => {
    const db = fakeDb([rev("u2", { createdAt: "2026-10-17T06:00:00.000Z" })]);
    expect(await resolveLorewardPlace(db as never, daily())).toBeNull();
  });
  it("pays no one when two accounts edited under the same label", async () => {
    // e.g. two players whose countries in different realms share a name.
    const db = fakeDb([rev("u2"), rev("u3")]);
    expect(await resolveLorewardPlace(db as never, daily())).toBeNull();
  });

  it("pays no one when one of the label's edits has no WikiOS account", async () => {
    const db = fakeDb([rev("u2"), rev(null)]);
    expect(await resolveLorewardPlace(db as never, daily())).toBeNull();
  });
});

describe("scoredEditsAccount (the dividend's scored revisions)", () => {
  const claims = [{ name: "Kir Republic", userId: "u9" }];
  it("pays the approved claim's owner when every revision came from MediaWiki", async () => {
    expect(await scoredEditsAccount(fakeDb([], claims) as never, "Kir Republic", [null])).toBe(
      "u9"
    );
    expect(await scoredEditsAccount(fakeDb([]) as never, "Kir Republic", [null, null])).toBeNull();
    const pending = fakeDb([], [{ ...claims[0]!, status: "PENDING" }]);
    expect(await scoredEditsAccount(pending as never, "Kir Republic", [null])).toBeNull();
  });

  it("credits the one WikiOS account on every revision, even when another account claims the name", async () => {
    expect(await scoredEditsAccount(fakeDb([], claims) as never, "Kir Republic", ["u2"])).toBe(
      "u2"
    );
  });

  it("pays no one for mixed revisions, or none", async () => {
    const db = fakeDb([], claims);
    expect(await scoredEditsAccount(db as never, "Kir Republic", ["u2", null])).toBeNull();
    expect(await scoredEditsAccount(db as never, "Kir Republic", ["u2", "u3"])).toBeNull();
    expect(await scoredEditsAccount(db as never, "Kir Republic", [])).toBeNull();
  });
});
