/** @jest-environment node */
/**
 * Phase 4b (Q11): the passport's forum footprint comes from the native forum, and only from what anyone may read:
 * not hidden, in a public category, in the site section or a published realm. Staff-only categories and draft
 * realms neither count nor confirm an old forum name.
 */
import { describe, expect, it, jest } from "@jest/globals";
import {
  forumActivityOf,
  importedAuthorByName,
} from "~/server/modules/thinkpages-forum/member-activity";

type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
type Rec = { [key: string]: Value };

/** A Prisma `where` over plain rows: equality, `in`, `not`, insensitive `equals`, `OR`, nested relations. */
function matches(row: Rec, where: Rec): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Rec[]).some((alt) => matches(row, alt));
    const value = row[key];
    if (cond === null || typeof cond !== "object" || Array.isArray(cond)) return value === cond;
    const c = cond as Rec;
    if ("in" in c) return (c.in as Value[]).includes(value as Value);
    if ("not" in c) return value !== c.not;
    if ("equals" in c) return String(value).toLowerCase() === String(c.equals).toLowerCase();
    return value !== null && typeof value === "object" && matches(value as Rec, c);
  });
}

const PUBLIC_SITE = { visibility: "public", scope: "site", realmId: null };
const STAFF_SITE = { visibility: "staff", scope: "site", realmId: null };
const DRAFT_REALM = { visibility: "public", scope: "realm", realmId: "r_draft" };
const LIVE_REALM = { visibility: "public", scope: "realm", realmId: "r_live" };

function thread(id: string, category: Rec, extra: Rec = {}): Rec {
  return { id, authorUserId: "u1", authorPersonaId: null, hidden: false, category, ...extra };
}

const THREADS = [
  thread("t_public", PUBLIC_SITE),
  thread("t_live", LIVE_REALM),
  thread("t_staff", STAFF_SITE),
  thread("t_draft", DRAFT_REALM),
  thread("t_hidden", PUBLIC_SITE, { hidden: true }),
  thread("t_persona", PUBLIC_SITE, { authorPersonaId: "pa1" }),
];

function post(id: string, threadRow: Rec, extra: Rec = {}): Rec {
  return {
    id,
    authorUserId: "u1",
    authorPersonaId: null,
    hidden: false,
    xenforoUserId: null,
    importedAuthorName: null,
    thread: threadRow,
    ...extra,
  };
}

const POSTS = [
  post("p_public", THREADS[0]!),
  post("p_live", THREADS[1]!),
  post("p_staff", THREADS[2]!),
  post("p_draft", THREADS[3]!),
  post("p_in_hidden_thread", THREADS[4]!),
  post("p_hidden", THREADS[0]!, { hidden: true }),
  post("p_staff_import", THREADS[2]!, {
    authorUserId: null,
    xenforoUserId: 66,
    importedAuthorName: "Secretive",
  }),
  post("p_draft_import", THREADS[3]!, {
    authorUserId: null,
    xenforoUserId: 55,
    importedAuthorName: "Drafted",
  }),
  post("p_public_import", THREADS[0]!, {
    authorUserId: null,
    xenforoUserId: 77,
    importedAuthorName: "OldTimer",
  }),
];

function fakeDb() {
  const filter = (rows: Rec[]) => (args: { where: Rec }) =>
    rows.filter((r) => matches(r, args.where));
  return {
    forumPost: {
      count: jest.fn(async (args: { where: Rec }) => filter(POSTS)(args).length),
      findFirst: jest.fn(async (args: { where: Rec }) => filter(POSTS)(args)[0] ?? null),
    },
    forumThread: { count: jest.fn(async (args: { where: Rec }) => filter(THREADS)(args).length) },
    realm: {
      findMany: jest.fn(async () => [
        { id: "r_live", status: "active" },
        { id: "r_draft", status: "draft" },
      ]),
    },
  };
}

describe("forumActivityOf", () => {
  it("counts only own, visible, public content: no staff category, draft realm, hidden or persona rows", async () => {
    await expect(forumActivityOf(fakeDb() as never, "u1")).resolves.toEqual({
      posts: 2, // p_public, p_live
      threads: 2, // t_public, t_live
    });
  });
});

describe("importedAuthorByName", () => {
  it("finds an old forum member by an imported name, case-insensitively, on public content", async () => {
    await expect(importedAuthorByName(fakeDb() as never, "oldtimer")).resolves.toEqual({
      userId: 77,
      username: "OldTimer",
    });
  });

  it("never confirms a name that only staff-only or draft-realm content carries", async () => {
    await expect(importedAuthorByName(fakeDb() as never, "Secretive")).resolves.toBeNull();
    await expect(importedAuthorByName(fakeDb() as never, "Drafted")).resolves.toBeNull();
  });

  it("is null for a name no imported post carries", async () => {
    await expect(importedAuthorByName(fakeDb() as never, "nobody")).resolves.toBeNull();
  });
});
