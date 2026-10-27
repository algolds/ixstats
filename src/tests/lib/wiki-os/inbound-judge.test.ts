/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Final review F1(c): the inbound rule never lets WikiOS's own conflict writes (trail dummy edits, talk notes) win or
 * lose by time. A classic edit that meets only them since a base WikiOS found is no collision; one that meets a
 * person's save is judged against that save, the system writes left out of the branch; with no base found the head (a
 * person's) is judged as before. WikiOS's side is stubbed: the readers have their own suites.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  // describeEachWikiosMode answers the switch and marker rows through this mock
  db: { systemConfig: { findUnique: jest.fn() } },
}));
jest.mock("~/lib/wiki-os/services/conflict-sides", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/conflict-sides"),
  classicChangeOfRevision: jest.fn(),
  wikiosBranchSince: jest.fn(),
  wikiosDeletion: jest.fn(),
  wikiosHead: jest.fn(),
}));

import type { PageChange } from "~/lib/wiki-os/services/conflict-rule";
import {
  classicChangeOfRevision,
  wikiosBranchSince,
  wikiosDeletion,
  wikiosHead,
} from "~/lib/wiki-os/services/conflict-sides";
import { judgeClassicEdit } from "~/lib/wiki-os/services/inbound-judge";
import type { MediaWikiRevision } from "~/lib/wiki-os/services/inbound-mediawiki";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 24, 12, minute));
const person = (ref: string, minute: number): PageChange => ({
  side: "wikios",
  action: "edit",
  ref,
  at: at(minute),
  author: { userId: "db-kir", classicName: null, ip: null, label: "Kir" },
});
const system = (ref: string, minute: number): PageChange => ({
  ...person(ref, minute),
  author: { userId: null, classicName: null, ip: null, label: "WikiOS" },
});
const classicEdit: PageChange = {
  side: "classic",
  action: "edit",
  ref: "105",
  at: at(5),
  author: { userId: null, classicName: "Bob", ip: null, label: null },
};
const rev = { revid: 105, parentid: 101 } as MediaWikiRevision;
const edit = { articleId: "a1", archived: false, rev, parentSha1: null, effectiveAt: undefined };

describeEachWikiosMode("judgeClassicEdit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(classicChangeOfRevision).mockResolvedValue(classicEdit);
    jest.mocked(wikiosDeletion).mockResolvedValue(null);
  });

  it("only WikiOS's own writes since the base: no collision, the writes handed back", async () => {
    const note = system("note", 9);
    jest.mocked(wikiosBranchSince).mockResolvedValue([note]);

    await expect(judgeClassicEdit(edit)).resolves.toEqual({
      kind: "past-system-writes",
      skipped: [note],
    });
  });

  it("a person's save among them: judged against the person's head, the system writes out of the branch", async () => {
    const kir = person("kir", 2);
    jest.mocked(wikiosBranchSince).mockResolvedValue([kir, system("trail", 9)]);
    jest.mocked(wikiosHead).mockResolvedValue(kir);

    const judged = await judgeClassicEdit(edit);

    expect(judged).toMatchObject({
      kind: "collision",
      verdict: { incomingWins: true, winner: classicEdit, overwritten: [kir] },
      skipped: [expect.objectContaining({ ref: "trail" })],
    });
  });

  it("only system writes and no base found (a parent WikiOS never had): no collision either, every person's revision is stamped", async () => {
    const note = system("note", 8);
    jest.mocked(wikiosBranchSince).mockResolvedValue([note]);
    jest.mocked(wikiosHead).mockResolvedValue(person("kir", 9));

    await expect(judgeClassicEdit(edit)).resolves.toEqual({
      kind: "past-system-writes",
      skipped: [note],
    });
  });

  it("a classic editor named WikiOS is a person: the edit is judged against their revision", async () => {
    // a classic revision WikiOS has is named by its MediaWiki id, never by a row id
    const namesake = { ...system("103", 8), ref: "103" };
    jest.mocked(wikiosBranchSince).mockResolvedValue([namesake]);
    jest.mocked(wikiosHead).mockResolvedValue(namesake);

    await expect(judgeClassicEdit(edit)).resolves.toMatchObject({
      kind: "collision",
      verdict: { incomingWins: false, winner: namesake },
      skipped: [],
    });
  });

  it("nothing since the base and no head: nothing to judge", async () => {
    jest.mocked(wikiosBranchSince).mockResolvedValue([]);
    jest.mocked(wikiosHead).mockResolvedValue(null);

    await expect(judgeClassicEdit(edit)).resolves.toEqual({ kind: "none" });
  });

  it("a page WikiOS deleted is judged against that delete", async () => {
    const deletion: PageChange = { ...person("log:1", 9), action: "delete" };
    jest.mocked(wikiosDeletion).mockResolvedValue(deletion);

    await expect(judgeClassicEdit({ ...edit, archived: true })).resolves.toMatchObject({
      kind: "collision",
      verdict: { incomingWins: false, winner: deletion },
    });
    expect(wikiosBranchSince).not.toHaveBeenCalled();
    expect(wikiosHead).not.toHaveBeenCalled();
  });
});
