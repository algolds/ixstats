/** @jest-environment node */
/**
 * An approved story chain is written to its wiki page only if its owner could still write it then: the edit right
 * checked at submit is checked again at approval and at every cron retry. While WikiOS editing is off the chain
 * waits (no write, no failure, written once editing is back); a blocked owner, a protected page or a page deleted
 * in the meantime (at the check or under the save) stamp the chain done with the reason in its note, so the cron
 * stops retrying it.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/wiki-os/core", () => ({
  ...jest.requireActual("~/lib/wiki-os/core"),
  ArticleRepository: { findBySlug: jest.fn() },
}));
jest.mock("~/lib/wiki-os/core/edit-conflict", () => ({ getHeadRevisionRefs: jest.fn() }));
jest.mock("~/lib/wiki-os/services/edit-service", () => ({
  assertCanEditArticle: jest.fn(),
  commitWikitextSave: jest.fn(),
}));

import { TRPCError } from "@trpc/server";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";
import { assertCanEditArticle, commitWikitextSave } from "~/lib/wiki-os/services/edit-service";
import { actionLinksRouter } from "~/server/api/routers/actionLinks";
import { createCallerFactory } from "~/server/api/trpc";
import { syncPostActionLinks } from "~/server/modules/action-links";
import { syncPendingChainWikis } from "~/server/modules/action-links/wiki-sync";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner, type Owner } from "~/tests/helpers/nation-world";

const links = createCallerFactory(actionLinksRouter);

let db: MemoryPrisma;
let ana: Owner;
let ola: Owner;

const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });
const READONLY = forbidden("readonly: WikiOS is read-only right now.");

/** Ana's chain of one post, submitted to "Northern Pact" (the submit check passes), then approved by Ola. */
async function approvedChain(): Promise<string> {
  await db.activityFeed.create({
    data: {
      id: "pact-1",
      type: "diplomatic",
      category: "diplomacy",
      title: "Signed the Northern Pact",
      description: "Signed the Northern Pact",
      countryId: "aurelia",
      visibility: "public",
      priority: "medium",
    },
  });
  await syncPostActionLinks(db as never, {
    postSource: "native",
    postRef: "p1",
    countryId: "aurelia",
    body: "[ixaction=pact-1]",
  });
  const anas = links(asOwner(db as never, ana));
  const { id } = await anas.createChain({ title: "Pact" });
  await anas.addPostToChain({ storylineId: id, postSource: "native", postRef: "p1" });
  await anas.submitChain({ storylineId: id, wikiPageTitle: "Northern Pact" });
  await links(asOwner(db as never, ola)).reviewChain({
    storylineId: id,
    approve: true,
    note: "Lovely.",
  });
  return id;
}

const chainRow = (id: string) => db.storyline.findUniqueOrThrow({ where: { id } });

beforeEach(async () => {
  for (const level of ["log", "info", "warn", "error"] as const) {
    jest.spyOn(console, level).mockImplementation(() => undefined);
  }
  jest.mocked(assertCanEditArticle).mockReset().mockResolvedValue(undefined);
  jest
    .mocked(commitWikitextSave)
    .mockReset()
    .mockResolvedValue({} as never);
  jest
    .mocked(ArticleRepository.findBySlug)
    .mockReset()
    .mockResolvedValue({ wikitext: "Intro." } as never);
  jest
    .mocked(getHeadRevisionRefs)
    .mockReset()
    .mockResolvedValue({ revisionRef: "rev-9", revisionRefs: ["rev-9"] } as never);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  for (const [id, name] of [
    ["aurelia", "Aurelia"],
    ["olania", "Olania"],
  ] as const) {
    await addNation(db as never, { id, name, baselineDate: new Date() });
  }
  ana = await addOwner(db as never, "ana", "aurelia");
  ola = await addOwner(db as never, "ola", "olania");
  await db.realmOfficer.create({
    data: {
      realmId: "default",
      userId: ola.clerkUserId,
      title: "Archivist",
      powers: ["board"],
      appointedBy: "system",
    },
  });
});
afterEach(() => jest.restoreAllMocks());

it("re-checks the owner's edit right on the page at approval, as the owner", async () => {
  const id = await approvedChain();

  // once at submit (as the signed-in Ana), once before the write (as Ana, loaded for the system save)
  expect(assertCanEditArticle).toHaveBeenCalledTimes(2);
  const [owner, title] = jest.mocked(assertCanEditArticle).mock.calls[1]!;
  expect(owner).toMatchObject({ auth: { userId: ana.clerkUserId }, user: { id: ana.id } });
  expect(title).toBe("Northern Pact");
  expect(commitWikitextSave).toHaveBeenCalledTimes(1);
  expect((await chainRow(id)).wikiSyncedAt).toBeInstanceOf(Date);
});

it("waits while WikiOS editing is off, without counting a failure, and writes once it is back", async () => {
  jest
    .mocked(assertCanEditArticle)
    .mockResolvedValueOnce(undefined) // the submit
    .mockRejectedValueOnce(READONLY) // the approval
    .mockRejectedValueOnce(READONLY); // the first cron run
  const id = await approvedChain();
  expect(commitWikitextSave).not.toHaveBeenCalled();
  expect(await chainRow(id)).toMatchObject({ status: "approved", wikiSyncedAt: null });

  expect(await syncPendingChainWikis()).toEqual({ synced: 0, failed: 0 });
  expect(commitWikitextSave).not.toHaveBeenCalled();

  expect(await syncPendingChainWikis()).toEqual({ synced: 1, failed: 0 });
  expect(commitWikitextSave).toHaveBeenCalledTimes(1);
  expect((await chainRow(id)).wikiSyncedAt).toBeInstanceOf(Date);
});

it.each([
  ["a blocked owner", forbidden("blocked: You are blocked from editing.")],
  ["a protected page", forbidden("protectedpage: This page is protected from edit (sysop).")],
  [
    "a page deleted since the submit",
    new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This page was deleted; ask an administrator to restore it",
    }),
  ],
])("stamps the chain done with the reason, never retried, for %s", async (_why, refusal) => {
  jest
    .mocked(assertCanEditArticle)
    .mockResolvedValueOnce(undefined) // the submit
    .mockRejectedValueOnce(refusal);
  const id = await approvedChain();

  expect(commitWikitextSave).not.toHaveBeenCalled();
  const row = await chainRow(id);
  expect(row.status).toBe("approved");
  expect(row.wikiSyncedAt).toBeInstanceOf(Date);
  expect(row.reviewNote).toBe(`Lovely.\n\nNot written to Northern Pact: ${refusal.message}`);
  expect(await syncPendingChainWikis()).toEqual({ synced: 0, failed: 0 });
  expect(assertCanEditArticle).toHaveBeenCalledTimes(2);
});

it("stamps the chain done when the page is deleted under the save, and still retries a transient failure", async () => {
  jest.mocked(commitWikitextSave).mockRejectedValueOnce(new Error("wiki down"));
  const id = await approvedChain();
  expect((await chainRow(id)).wikiSyncedAt).toBeNull();

  jest.mocked(commitWikitextSave).mockRejectedValueOnce(
    new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This page was deleted; ask an administrator to restore it",
    })
  );
  expect(await syncPendingChainWikis()).toEqual({ synced: 1, failed: 0 });
  const row = await chainRow(id);
  expect(row.wikiSyncedAt).toBeInstanceOf(Date);
  expect(row.reviewNote).toMatch(/Not written to Northern Pact: This page was deleted/);
  expect(await syncPendingChainWikis()).toEqual({ synced: 0, failed: 0 });
});
