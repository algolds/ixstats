/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Final review F1(c): a talk note a classic edit left out of the talk page is owed again. Only a note (a system write
 * whose summary names its conflict and that appended a section) counts, only for the recipients told on that talk page,
 * and only when the new head lacks the note's section; a trail, a person's edit and a note the new text kept are not.
 *
 * Real conflict log over the in-memory WikiOS tables (Prisma mode), in both WikiOS modes.
 */
jest.mock("~/server/db", () => {
  const fake = jest
    .requireActual("~/tests/helpers/fake-wiki-db")
    .createFakeWikiDb({ prisma: true });
  return { __esModule: true, fake, db: fake.db, isDatabaseReadOnly: true };
});

import { db } from "~/server/db";
import { conflictKey, type PageChange } from "~/lib/wiki-os/services/conflict-rule";
import { markNotified, recordConflict } from "~/lib/wiki-os/services/conflict-log";
import { reopenSkippedNotes } from "~/lib/wiki-os/services/conflict-note-reopen";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { seedWikiosMode, WIKIOS_MODES } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

const TALK = "User talk:Bob";
const BASE = "Hello Bob.";
const SECTION = "== Your edit to [[Caphiria]] was replaced ==\nA later edit replaced it.";

const bobLost: PageChange = {
  side: "classic",
  action: "edit",
  ref: "102",
  at: new Date("2026-10-24T12:00:00Z"),
  author: { userId: null, classicName: "Bob", ip: null, label: null },
};

/** A conflict that overwrote Bob's classic edit, its talk-page notice to Bob marked delivered. */
async function bobToldOnTalk(): Promise<string> {
  const winner: PageChange = {
    ...bobLost,
    side: "wikios",
    ref: "wk-1",
    author: { ...bobLost.author, classicName: null, label: "Kir" },
  };
  const { id } = await recordConflict(db, {
    source: "ixwiki",
    articleId: "caphiria",
    title: "Caphiria",
    verdict: {
      winner,
      overwritten: [bobLost],
      incomingWins: true,
      key: conflictKey("ixwiki", "caphiria", winner.ref),
    },
    baseRef: "101",
  });
  await markNotified(id, "name:Bob", "talk-page");
  tables.wikiConflict.rows.find((row) => row.id === id)!.settledAt = new Date();
  return id;
}

/** Bob's talk page with its base revision, and a revision on it `over` describes. */
function talkRevision(over: Record<string, unknown>) {
  const talk =
    tables.wikiArticle.rows.find((row) => row.title === TALK) ??
    tables.wikiArticle.insert({ title: TALK, slug: "User_talk:Bob", wikitext: BASE });
  const base =
    tables.wikiRevision.rows.find((row) => row.articleId === talk.id && row.wikitext === BASE) ??
    tables.wikiRevision.insert({
      articleId: talk.id,
      wikitext: BASE,
      origin: "classic",
      mwRevId: 101,
    });
  return tables.wikiRevision.insert({
    articleId: talk.id,
    parentRevisionId: base.id,
    origin: "wikios",
    author: "WikiOS",
    authorId: null,
    ...over,
  });
}

const asSkipped = (row: Record<string, unknown>): PageChange => ({
  side: "wikios",
  action: "edit",
  ref: String(row.id),
  at: new Date(),
  author: { userId: null, classicName: null, ip: null, label: "WikiOS" },
});
const row = (id: string) => tables.wikiConflict.rows.find((candidate) => candidate.id === id)!;
const REPLY = `${BASE}\n\nThanks Carol.`;

describe.each(WIKIOS_MODES)("reopenSkippedNotes [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    fake.reset();
    restoreMode = await seedWikiosMode(fake.db, mode);
  });
  afterEach(() => restoreMode());

  it("owes again the notice of a note the new head left out: the talk mark is taken back and the row is open", async () => {
    const id = await bobToldOnTalk();
    // the other marks stay: another channel of Bob's, another recipient's talk note
    await markNotified(id, "name:Bob", "in-app");
    await markNotified(id, "name:Carol", "talk-page");
    const note = talkRevision({
      wikitext: `${BASE}\n\n${SECTION}`,
      summary: `Your edit to Caphiria was replaced (conflict ${id})`,
    });

    await expect(reopenSkippedNotes(TALK, [asSkipped(note)], REPLY)).resolves.toBe(1);

    expect(row(id)).toMatchObject({ settledAt: null });
    expect(row(id).notified).toEqual([
      expect.objectContaining({ key: "name:Bob", channel: "in-app" }),
      expect.objectContaining({ key: "name:Carol", channel: "talk-page" }),
    ]);
  });

  it("a note sent again since supersedes the first: only the newest note of the conflict on the page can be owed again", async () => {
    const id = await bobToldOnTalk();
    const summary = `Your edit to Caphiria was replaced (conflict ${id})`;
    const first = talkRevision({
      wikitext: `${BASE}\n\n${SECTION}`,
      summary,
      createdAt: new Date("2026-10-24T12:00:00Z"),
    });
    const again = talkRevision({
      wikitext: `${REPLY}\n\n${SECTION}`,
      summary,
      createdAt: new Date("2026-10-24T13:00:00Z"),
    });

    // Bob archived the note sent again; the first, withheld note comes up once more
    await expect(
      reopenSkippedNotes(TALK, [asSkipped(first)], `${REPLY}\n\nArchived.`)
    ).resolves.toBe(0);
    expect(row(id).notified).toHaveLength(1);

    await expect(reopenSkippedNotes(TALK, [asSkipped(again)], `${BASE}\n\nOther.`)).resolves.toBe(
      1
    );
  });

  it("a later person's edit of the page, or a later note of another conflict, is no note sent again", async () => {
    const id = await bobToldOnTalk();
    const note = talkRevision({
      wikitext: `${BASE}\n\n${SECTION}`,
      summary: `Your edit to Caphiria was replaced (conflict ${id})`,
      createdAt: new Date("2026-10-24T12:00:00Z"),
    });
    talkRevision({
      wikitext: `${BASE}\n\n${SECTION}\n\nThanks.`,
      summary: `Reply (conflict ${id})`,
      author: "Kir",
      authorId: "db-kir",
      createdAt: new Date("2026-10-24T13:00:00Z"),
    });
    talkRevision({
      wikitext: `${BASE}\n\nAnother note.`,
      summary: "Your edit to Urcea was replaced (conflict other-1)",
      createdAt: new Date("2026-10-24T14:00:00Z"),
    });

    await expect(reopenSkippedNotes(TALK, [asSkipped(note)], REPLY)).resolves.toBe(1);
  });

  it("a reopened row's give-up window starts again: its first settle attempt is cleared", async () => {
    const id = await bobToldOnTalk();
    row(id).firstSettleAt = new Date("2026-10-20T00:00:00Z");
    const note = talkRevision({
      wikitext: `${BASE}\n\n${SECTION}`,
      summary: `Your edit to Caphiria was replaced (conflict ${id})`,
    });

    await reopenSkippedNotes(TALK, [asSkipped(note)], REPLY);

    expect(row(id).firstSettleAt).toBeNull();
  });

  it("a note whose section the new head kept was seen: nothing is owed", async () => {
    const id = await bobToldOnTalk();
    const note = talkRevision({
      wikitext: `${BASE}\n\n${SECTION}`,
      summary: `Your edit to Caphiria was replaced (conflict ${id})`,
    });

    await expect(
      reopenSkippedNotes(TALK, [asSkipped(note)], `${REPLY}\n\n${SECTION}`)
    ).resolves.toBe(0);

    expect(row(id).notified).toHaveLength(1);
  });

  it("a trail, a person's edit, a summary naming no conflict, a revision that appended nothing and one that rewrote its parent are no notes", async () => {
    const id = await bobToldOnTalk();
    const trail = talkRevision({
      wikitext: `${BASE}\n\n${SECTION}`,
      summary: `Overwrote x (conflict ${id})`,
    });
    row(id).trailRevisionId = trail.id;
    const person = talkRevision({
      wikitext: `${BASE}\n\n${SECTION}`,
      summary: `Your edit to Caphiria was replaced (conflict ${id})`,
      author: "Kir",
      authorId: "db-kir",
    });
    const unnamed = talkRevision({ wikitext: `${BASE}\n\n${SECTION}`, summary: "A note" });
    const empty = talkRevision({ wikitext: BASE, summary: `Overwrote (conflict ${id})` });
    const rewritten = talkRevision({
      wikitext: `Hi Bob.\n\n${SECTION}`,
      summary: `Your edit to Caphiria was replaced (conflict ${id})`,
    });

    const skipped = [trail, person, unnamed, empty, rewritten].map(asSkipped);
    await expect(reopenSkippedNotes(TALK, skipped, REPLY)).resolves.toBe(0);

    expect(row(id).notified).toHaveLength(1);
  });

  it("only the recipients told on that talk page are owed again", async () => {
    const id = await bobToldOnTalk();
    const note = talkRevision({
      wikitext: `${BASE}\n\n${SECTION}`,
      summary: `Your edit to Caphiria was replaced (conflict ${id})`,
    });

    await expect(reopenSkippedNotes("User talk:Carol", [asSkipped(note)], REPLY)).resolves.toBe(0);

    expect(row(id).notified).toHaveLength(1);
  });
});
