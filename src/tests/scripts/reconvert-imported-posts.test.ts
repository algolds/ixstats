/** @jest-environment node */
import type { PlannedPost } from "~/lib/thinkpages-forum/import/plan";
import {
  localDatabaseRefusal,
  parseReconvertArgs,
  planReconvert,
  reconvertLines,
  type StoredPost,
} from "../../../scripts/migrations/reconvert-imported-posts-plan";

const url = (db: string, host = "localhost") => `postgresql://u:p@${host}:5433/${db}?schema=public`;
const EDITED = new Date("2025-03-01T10:00:00Z");

function planned(xenforoPostId: number, extra: Partial<PlannedPost> = {}): PlannedPost {
  return {
    xenforoPostId,
    xenforoUserId: 7,
    authorUserId: null,
    importedAuthorName: "Admin",
    contentHtml: `<p>new ${xenforoPostId}</p>`,
    plainText: `new ${xenforoPostId}`,
    hidden: false,
    createdAt: new Date(0),
    editedAt: null,
    ...extra,
  };
}

function stored(xenforoPostId: number, extra: Partial<StoredPost> = {}): StoredPost {
  return {
    id: `native-${xenforoPostId}`,
    xenforoPostId,
    contentHtml: `<p>old ${xenforoPostId}</p>`,
    plainText: `old ${xenforoPostId}`,
    editedAt: null,
    contentWikitext: null,
    ...extra,
  };
}

const byXenforoId = (...posts: StoredPost[]) => new Map(posts.map((p) => [p.xenforoPostId, p]));

describe("planReconvert", () => {
  it("plans only imported posts whose converted HTML differs", () => {
    const plan = planReconvert(
      [planned(1), planned(2, { contentHtml: "<p>old 2</p>", plainText: "old 2" }), planned(3)],
      byXenforoId(stored(1), stored(2))
    );
    expect(plan.updates).toEqual([
      { id: "native-1", xenforoPostId: 1, contentHtml: "<p>new 1</p>", plainText: "new 1" },
    ]);
    expect(plan).toMatchObject({ unchanged: 1, notImported: 1, editedSince: 0 });
  });

  it("plans a post whose text is the same but whose plain text differs", () => {
    const plan = planReconvert(
      [planned(1, { contentHtml: "<p>old 1</p>", plainText: "changed" })],
      byXenforoId(stored(1))
    );
    expect(plan.updates.map((u) => u.id)).toEqual(["native-1"]);
  });

  it("leaves a post edited on the forum since the import, or written with Canvas", () => {
    const plan = planReconvert(
      [planned(1), planned(2), planned(3, { editedAt: EDITED })],
      byXenforoId(
        stored(1, { editedAt: EDITED }),
        stored(2, { contentWikitext: "== x ==" }),
        stored(3, { editedAt: EDITED })
      )
    );
    expect(plan.updates.map((u) => u.xenforoPostId)).toEqual([3]);
    expect(plan.editedSince).toBe(2);
  });

  it("points a quote at the native post and drops the id of a post that is not imported", () => {
    const quote = (id: string) =>
      `<blockquote class="forum-quote" data-post="${id}">q</blockquote>`;
    const plan = planReconvert(
      [planned(5, { contentHtml: quote("1") + quote("999") })],
      byXenforoId(stored(1), stored(5))
    );
    expect(plan.updates[0]!.contentHtml).toBe(
      quote("native-1") + '<blockquote class="forum-quote">q</blockquote>'
    );
  });

  it("is idempotent: its own result plans nothing", () => {
    const first = planReconvert([planned(1)], byXenforoId(stored(1)));
    const after = byXenforoId(stored(1, first.updates[0]!));
    expect(planReconvert([planned(1)], after).updates).toEqual([]);
  });
});

describe("reconvertLines", () => {
  it("counts the plan and says whether anything was written", () => {
    const plan = planReconvert([planned(1), planned(2)], byXenforoId(stored(1)));
    expect(reconvertLines(plan, false)).toEqual([
      "Posts to re-convert: 1 (unchanged 0, not imported 1, edited since import 0)",
      "Dry run: nothing written. Pass --apply to write.",
    ]);
    expect(reconvertLines(plan, true)[1]).toBe("Updated 1 posts.");
  });
});

describe("parseReconvertArgs", () => {
  it("is a dry run by default and --apply writes", () => {
    expect(parseReconvertArgs(["--snapshot", "d"], url("ixstats_wv1"))).toEqual({
      args: { snapshot: "d", nodeMap: null, apply: false },
    });
    expect(
      parseReconvertArgs(["--snapshot", "d", "--node-map", "m.json", "--apply"], url("ixstats"))
    ).toEqual({ error: expect.stringContaining("production database") });
    expect(
      parseReconvertArgs(["--snapshot", "d", "--node-map", "m.json", "--apply"], url("ixstats_wv1"))
    ).toEqual({ args: { snapshot: "d", nodeMap: "m.json", apply: true } });
  });

  it("needs a snapshot and rejects unknown arguments, including --production", () => {
    expect(parseReconvertArgs([], url("x"))).toEqual({
      error: expect.stringContaining("--snapshot"),
    });
    expect(parseReconvertArgs(["--snapshot", "d", "--production"], url("x"))).toEqual({
      error: "Unknown argument: --production",
    });
    expect(parseReconvertArgs(["--snapshot"], url("x"))).toEqual({
      error: "--snapshot needs a value",
    });
  });

  it("refuses the production database even when it is local", () => {
    expect(parseReconvertArgs(["--snapshot", "d"], url("ixstats"))).toEqual({
      error: expect.stringContaining("production database"),
    });
  });

  it("refuses a database that is not local", () => {
    expect(parseReconvertArgs(["--snapshot", "d"], url("ixstats_wv1", "db.example.com"))).toEqual({
      error: expect.stringContaining("not local"),
    });
  });
});

describe("localDatabaseRefusal", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])("allows %s", (host) => {
    expect(localDatabaseRefusal(url("x", host))).toBeNull();
  });

  it.each(["db.example.com", "10.0.0.5", "localhost.evil.example"])("refuses %s", (host) => {
    expect(localDatabaseRefusal(url("x", host))).toMatch(/not local/);
  });

  it("refuses a missing or unusable DATABASE_URL", () => {
    expect(localDatabaseRefusal(undefined)).toMatch(/DATABASE_URL/);
  });
});
