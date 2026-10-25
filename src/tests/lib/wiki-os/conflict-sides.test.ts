/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Final review F1(c): the head a collision is judged against is a person's revision, never one of WikiOS's own conflict
 * writes (`isSystemRevision`: no account, under `CONFLICT_NOTICE_AUTHOR`, saved in WikiOS). A player whose handle is
 * that name, a classic editor of that name and a revision with no author are people.
 *
 * Real readers over the in-memory WikiOS tables (Prisma mode), in both WikiOS modes.
 */
jest.mock("~/server/db", () => {
  const fake = jest
    .requireActual("~/tests/helpers/fake-wiki-db")
    .createFakeWikiDb({ prisma: true });
  return { __esModule: true, fake, db: fake.db, isDatabaseReadOnly: true };
});

import { CONFLICT_NOTICE_AUTHOR, wikiosHead } from "~/lib/wiki-os/services/conflict-sides";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { seedWikiosMode, WIKIOS_MODES } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

let minute = 0;
/** A revision of the page, a minute after the last. */
const revision = (over: Record<string, unknown>) =>
  tables.wikiRevision.insert({
    articleId: "a1",
    wikitext: "text",
    parked: false,
    origin: "wikios",
    createdAt: new Date(Date.UTC(2026, 9, 24, 12, ++minute)),
    ...over,
  });
const systemWrite = () => revision({ author: CONFLICT_NOTICE_AUTHOR, authorId: null });

describe.each(WIKIOS_MODES)("wikiosHead [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    fake.reset();
    minute = 0;
    restoreMode = await seedWikiosMode(fake.db, mode);
  });
  afterEach(() => restoreMode());

  it("skips WikiOS's own conflict writes on top: the newest person's revision stands", async () => {
    const kir = revision({ author: "Kir", authorId: "db-kir" });
    systemWrite();
    systemWrite();

    await expect(wikiosHead("a1")).resolves.toMatchObject({ ref: kir.id, side: "wikios" });
  });

  it("a player whose handle is that name is a person", async () => {
    systemWrite();
    const player = revision({ author: CONFLICT_NOTICE_AUTHOR, authorId: "db-wikios-fan" });
    systemWrite();

    await expect(wikiosHead("a1")).resolves.toMatchObject({ ref: player.id });
  });

  it("a classic editor of that name, and a revision with no author, are people", async () => {
    const classic = revision({
      author: CONFLICT_NOTICE_AUTHOR,
      authorId: null,
      origin: "classic",
      mwRevId: 7,
    });
    systemWrite();

    await expect(wikiosHead("a1")).resolves.toMatchObject({ ref: "7" });

    const anonymous = revision({ author: null, authorId: null });
    systemWrite();
    await expect(wikiosHead("a1")).resolves.toMatchObject({ ref: anonymous.id });
    expect(classic.id).toBeDefined();
  });

  it("a page with nothing but system writes has no head to judge against", async () => {
    systemWrite();

    await expect(wikiosHead("a1")).resolves.toBeNull();
  });
});
