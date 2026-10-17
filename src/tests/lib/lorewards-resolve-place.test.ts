/** @jest-environment node */
/**
 * Who a Loreward place pays. The bot scores MediaWiki, where an unlinked WikiOS author's edits arrive as
 * `wikios>Label` (a name no MediaWiki account can hold) and every other name is a MediaWiki account, or a linked
 * WikiOS user mirrored under it. A plain name pays only its exact verified-link holder. A `wikios>` name pays the one
 * WikiOS account behind the label's edits to the winning page inside the contest. A link never applies to it.
 */
import { describe, it, expect } from "@jest/globals";
import {
  canonicalWikiName,
  contestWindow,
  placeOf,
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
interface Link {
  username: string;
  userId: string;
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

/** A database holding these revisions and verified ixwiki links, answering the queries the resolver makes. */
function fakeDb(revisions: Revision[], links: Link[] = []) {
  return {
    wikiAccountLink: {
      findFirst: jest.fn(async ({ where }: { where: { username: string } }) => {
        const link = links.find((l) => l.username === where.username);
        return link ? { userId: link.userId } : null;
      }),
    },
    wikiRevision: {
      groupBy: jest.fn(async ({ where }: { where: RevisionWhere }) =>
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
  it("pays the exact verified-link holder of the normalized name, without reading revisions", async () => {
    const db = fakeDb([rev("u2")], [{ username: "Kir Republic", userId: "u1" }]);
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "Kir_Republic" }))).toBe("u1");
    expect(db.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: { source: "ixwiki", username: "Kir Republic", verifiedAt: { not: null } },
      select: { userId: true },
    });
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it("pays no one without a link, even with WikiOS edits under that name on the page", async () => {
    const db = fakeDb([rev("u2"), rev("u2", { createdAt: "2026-10-16T18:00:00.000Z" })]);
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "Kir Republic" }))).toBeNull();
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it("does not match a verified link that differs in case after the first letter", async () => {
    // MediaWiki usernames are case-sensitive after the first letter: "OstroZava" is another account.
    const db = fakeDb([], [{ username: "OstroZava", userId: "u9" }]);
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "Ostrozava" }))).toBeNull();
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

  it("never applies a link: a link for the label's name does not pay the holder", async () => {
    const db = fakeDb([rev("u2")], [{ username: "Kir Republic", userId: "u9" }]);
    expect(await resolveLorewardPlace(db as never, daily())).toBe("u2");
    expect(db.wikiAccountLink.findFirst).not.toHaveBeenCalled();
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

  it("pays no one with no edits by the label on the page in the contest", async () => {
    const otherPage = fakeDb([rev("u2", { page: "My own page" })]);
    expect(await resolveLorewardPlace(otherPage as never, daily())).toBeNull();
    const otherLabel = fakeDb([rev("u2", { author: "Kir_Republic" })]);
    expect(await resolveLorewardPlace(otherLabel as never, daily())).toBeNull();
  });

  it("ignores a redirect article left at the winning title by a page move", async () => {
    const db = fakeDb([rev("u9", { redirect: true })]);
    expect(await resolveLorewardPlace(db as never, daily())).toBeNull();
  });

  it("reads the label as the mirror wrote it, and the page by its canonical title", async () => {
    const db = fakeDb([rev("u2")]);
    const place = daily({ wikiUser: "wikios> Kir Republic ", page: "seneca_front" });
    expect(await resolveLorewardPlace(db as never, place)).toBe("u2");
  });

  it("reads a weekly's edits across its recorded range", async () => {
    const week = daily({
      type: "weekly",
      date: "2026-W42",
      dateStart: "2026-10-12",
      dateEnd: "2026-10-18",
    });
    const sunday = fakeDb([rev("u2", { createdAt: "2026-10-19T03:00:00.000Z" })]);
    expect(await resolveLorewardPlace(sunday as never, week)).toBe("u2");
    const monday = fakeDb([rev("u2", { createdAt: "2026-10-19T07:00:00.000Z" })]);
    expect(await resolveLorewardPlace(monday as never, week)).toBeNull();
  });

  it("pays no one without a page, or for a weekly or monthly with no range, and does not look", async () => {
    const db = fakeDb([rev("u2")]);
    expect(await resolveLorewardPlace(db as never, daily({ page: null }))).toBeNull();
    expect(
      await resolveLorewardPlace(db as never, daily({ type: "weekly", date: "2026-10-12" }))
    ).toBeNull();
    expect(
      await resolveLorewardPlace(db as never, daily({ type: "monthly", date: "2026-10-01" }))
    ).toBeNull();
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });
});

describe("scoredEditsAccount (the dividend's scored revisions)", () => {
  const links = [{ username: "Kir Republic", userId: "u9" }];

  it("pays the one WikiOS account on the revisions, even when someone holds a link for the name", async () => {
    const db = fakeDb([], links);
    expect(await scoredEditsAccount(db as never, "Kir Republic", ["u2", "u2"])).toBe("u2");
    expect(db.wikiAccountLink.findFirst).not.toHaveBeenCalled();
  });

  it("pays the exact link holder when every revision came from MediaWiki", async () => {
    expect(await scoredEditsAccount(fakeDb([], links) as never, "Kir Republic", [null])).toBe("u9");
    expect(await scoredEditsAccount(fakeDb([]) as never, "Kir Republic", [null, null])).toBeNull();
  });

  it("pays no one for mixed revisions, or none", async () => {
    const db = fakeDb([], links);
    expect(await scoredEditsAccount(db as never, "Kir Republic", ["u2", null])).toBeNull();
    expect(await scoredEditsAccount(db as never, "Kir Republic", ["u2", "u3"])).toBeNull();
    expect(await scoredEditsAccount(db as never, "Kir Republic", [])).toBeNull();
  });
});

describe("placeOf", () => {
  const entry = {
    type: "daily",
    date: "2026-10-16",
    dateStart: null,
    dateEnd: null,
    winnerUser: "wikios>Kir Republic",
    winnerPage: "Seneca front",
    runnerUpUser: "Other",
    runnerUpPage: null,
  };

  it("is the place's name, page, contest and dates", () => {
    expect(placeOf(entry, "winner")).toEqual(daily());
    expect(placeOf(entry, "runner-up")).toEqual(daily({ wikiUser: "Other", page: null }));
  });

  it("is null for a place nobody holds", () => {
    expect(placeOf({ ...entry, runnerUpUser: null }, "runner-up")).toBeNull();
  });
});

describe("contestWindow", () => {
  it("covers the contest's Eastern days: from 00:00Z on the first to 06:00Z after the last", () => {
    expect(contestWindow(daily())).toEqual({
      gte: new Date("2026-10-16T00:00:00.000Z"),
      lt: new Date("2026-10-17T06:00:00.000Z"),
    });
    const month = daily({ type: "monthly", dateStart: "2026-10-01", dateEnd: "2026-10-31" });
    expect(contestWindow(month)?.lt).toEqual(new Date("2026-11-01T06:00:00.000Z"));
  });

  it("is null when the dates are not days, or a weekly or monthly has no range", () => {
    expect(contestWindow(daily({ date: "2026-W42" }))).toBeNull();
    expect(contestWindow(daily({ dateStart: "2026-10-01", dateEnd: "soon" }))).toBeNull();
    expect(contestWindow(daily({ type: "weekly", date: "2026-10-12" }))).toBeNull();
  });
});

describe("canonicalWikiName", () => {
  it("normalizes a MediaWiki name, and keeps a wikios> name as the mirror writes it", () => {
    expect(canonicalWikiName("ada_lovelace")).toBe("Ada lovelace");
    expect(canonicalWikiName("OstroZava")).toBe("OstroZava");
    expect(canonicalWikiName("wikios> kir_Republic ")).toBe("wikios>kir_Republic");
  });
});
