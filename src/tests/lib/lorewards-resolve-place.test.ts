/** @jest-environment node */
/**
 * Who a Loreward place pays: "WikiOS edits earn without a link; MediaWiki edits need a verified link". A verified
 * ixwiki link for the place's name wins; otherwise the place's winning edits (ixwiki revisions under the name, on the
 * winning page, inside the contest's days) must all carry one WikiOS account.
 */
import { describe, it, expect } from "@jest/globals";
import {
  contestWindow,
  nameSpellings,
  placeOf,
  resolveLorewardPlace,
  type LorewardPlaceRef,
} from "~/lib/lorewards/resolve-user";

interface Revision {
  author: string | null;
  authorId: string | null;
  source: string;
  createdAt: string;
  page: string;
}
interface Link {
  username: string;
  userId: string;
}
interface RevisionWhere {
  source: string;
  author: { in: string[] };
  createdAt: { gte: Date; lt: Date };
  article: { source: string; title: string };
}

const rev = (
  author: string | null,
  authorId: string | null,
  over: Partial<Revision> = {}
): Revision => ({
  author,
  authorId,
  source: "ixwiki",
  createdAt: "2026-10-16T12:00:00.000Z",
  page: "Seneca front",
  ...over,
});

const matches = (r: Revision, where: RevisionWhere) => {
  const at = new Date(r.createdAt);
  return (
    r.source === where.source &&
    where.author.in.includes(r.author ?? "") &&
    at >= where.createdAt.gte &&
    at < where.createdAt.lt &&
    where.article.source === "ixwiki" &&
    r.page === where.article.title
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
  wikiUser: "Kir Republic",
  page: "Seneca front",
  date: "2026-10-16",
  dateStart: null,
  dateEnd: null,
  ...over,
});

describe("resolveLorewardPlace", () => {
  it("pays the verified ixwiki link for the normalized name, without reading revisions", async () => {
    const db = fakeDb([rev("Kir Republic", "u2")], [{ username: "Kir Republic", userId: "u1" }]);
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "Kir_Republic" }))).toBe("u1");
    expect(db.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: { source: "ixwiki", username: "Kir Republic", verifiedAt: { not: null } },
      select: { userId: true },
    });
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });

  it("does not match a verified link that differs in case after the first letter", async () => {
    // MediaWiki usernames are case-sensitive after the first letter: "OstroZava" is another account.
    const db = fakeDb([], [{ username: "OstroZava", userId: "u9" }]);
    expect(await resolveLorewardPlace(db as never, daily({ wikiUser: "Ostrozava" }))).toBeNull();
  });

  it("pays the WikiOS account behind every winning edit, on the page and inside the day", async () => {
    const db = fakeDb([
      rev("Kir Republic", "u2"),
      rev("Kir Republic", "u2", { createdAt: "2026-10-16T23:59:00.000Z" }),
    ]);
    expect(await resolveLorewardPlace(db as never, daily())).toBe("u2");
    expect(db.wikiRevision.groupBy).toHaveBeenCalledWith({
      by: ["authorId"],
      where: {
        source: "ixwiki",
        author: { in: ["Kir Republic", "Kir_Republic"] },
        createdAt: {
          gte: new Date("2026-10-16T00:00:00.000Z"),
          lt: new Date("2026-10-17T00:00:00.000Z"),
        },
        article: { source: "ixwiki", title: "Seneca front" },
      },
    });
  });

  it("pays no one for a squatter's WikiOS edits on another page or outside the contest", async () => {
    // The real winner's MediaWiki edits were never mirrored; the squatter edits under the same name.
    const otherPage = fakeDb([rev("Kir Republic", "u9", { page: "My own page" })]);
    expect(await resolveLorewardPlace(otherPage as never, daily())).toBeNull();
    const dayBefore = fakeDb([
      rev("Kir Republic", "u9", { createdAt: "2026-10-15T23:00:00.000Z" }),
    ]);
    expect(await resolveLorewardPlace(dayBefore as never, daily())).toBeNull();
  });

  it("pays no one when a winning edit is an unverified MediaWiki edit", async () => {
    const db = fakeDb([rev("Kir Republic", null), rev("Kir Republic", "u2")]);
    expect(await resolveLorewardPlace(db as never, daily())).toBeNull();
  });

  it("pays no one when two accounts made winning edits under the name", async () => {
    const db = fakeDb([rev("Kir Republic", "u2"), rev("Kir Republic", "u3")]);
    expect(await resolveLorewardPlace(db as never, daily())).toBeNull();
  });

  it("matches a WikiOS label spelled with underscores", async () => {
    const db = fakeDb([rev("Kir_Republic", "u2")]);
    expect(await resolveLorewardPlace(db as never, daily())).toBe("u2");
  });

  it("ignores other wikis' revisions on a page of the same title", async () => {
    const db = fakeDb([rev("Kir Republic", "u3", { source: "iiwiki" }), rev("Kir Republic", "u2")]);
    expect(await resolveLorewardPlace(db as never, daily())).toBe("u2");
  });

  it("finds the winning page by its canonical title", async () => {
    const db = fakeDb([rev("Kir Republic", "u2")]);
    expect(await resolveLorewardPlace(db as never, daily({ page: "seneca_front" }))).toBe("u2");
  });

  it("reads a weekly's edits across its recorded days", async () => {
    const week = daily({ date: "2026-W42", dateStart: "2026-10-12", dateEnd: "2026-10-18" });
    const inside = fakeDb([rev("Kir Republic", "u2", { createdAt: "2026-10-18T22:00:00.000Z" })]);
    expect(await resolveLorewardPlace(inside as never, week)).toBe("u2");
    const after = fakeDb([rev("Kir Republic", "u2", { createdAt: "2026-10-19T01:00:00.000Z" })]);
    expect(await resolveLorewardPlace(after as never, week)).toBeNull();
  });

  it("pays no one without a winning page or contest days, and does not look", async () => {
    const db = fakeDb([rev("Kir Republic", "u2")]);
    expect(await resolveLorewardPlace(db as never, daily({ page: null }))).toBeNull();
    expect(await resolveLorewardPlace(db as never, daily({ date: "2026-W42" }))).toBeNull();
    expect(db.wikiRevision.groupBy).not.toHaveBeenCalled();
  });
});

describe("placeOf", () => {
  const entry = {
    date: "2026-10-16",
    dateStart: null,
    dateEnd: null,
    winnerUser: "Kir Republic",
    winnerPage: "Seneca front",
    runnerUpUser: "Other",
    runnerUpPage: null,
  };

  it("is the place's name, page and contest days", () => {
    expect(placeOf(entry, "winner")).toEqual(daily());
    expect(placeOf(entry, "runner-up")).toEqual(daily({ wikiUser: "Other", page: null }));
  });

  it("is null for a place nobody holds", () => {
    expect(placeOf({ ...entry, runnerUpUser: null }, "runner-up")).toBeNull();
  });
});

describe("nameSpellings", () => {
  it("is the name as recorded, with spaces and with underscores", () => {
    expect(nameSpellings("Kir_Republic")).toEqual(["Kir_Republic", "Kir Republic"]);
    expect(nameSpellings("kir republic")).toEqual(["kir republic", "Kir republic", "Kir_republic"]);
  });
});

describe("contestWindow", () => {
  it("is the entry's day, or its recorded range, as UTC instants", () => {
    expect(contestWindow(daily())).toEqual({
      gte: new Date("2026-10-16T00:00:00.000Z"),
      lt: new Date("2026-10-17T00:00:00.000Z"),
    });
    expect(contestWindow(daily({ dateStart: "2026-10-01", dateEnd: "2026-10-31" }))?.lt).toEqual(
      new Date("2026-11-01T00:00:00.000Z")
    );
  });

  it("is null when the dates are not days", () => {
    expect(contestWindow(daily({ date: "2026-W42" }))).toBeNull();
    expect(contestWindow(daily({ dateStart: "2026-10-01", dateEnd: "soon" }))).toBeNull();
  });
});
