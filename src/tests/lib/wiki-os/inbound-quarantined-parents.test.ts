/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Task 12 fix round 1 (I2): a classic revision whose parent the sync quarantined is followed back through quarantined
 * revisions only; when that chain reaches WikiOS's head it builds on the head (a fast-forward, not a collision). Any
 * revision in between that was not quarantined, an unstamped head, or a chain that ends elsewhere is a collision as before.
 */
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";

let mockDb: MemoryPrisma;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/wiki-os/services/inbound-mediawiki", () => ({ fetchRevisionHash: jest.fn() }));

import { fetchRevisionHash } from "~/lib/wiki-os/services/inbound-mediawiki";
import { buildsOnHeadPastQuarantine } from "~/lib/wiki-os/services/inbound-quarantined-parents";
import type { InboundHead } from "~/lib/wiki-os/services/inbound-decision";
import { WIKIOS_MODES, seedWikiosMode } from "~/tests/helpers/wikios-modes";

const fetchHash = jest.mocked(fetchRevisionHash);

const head = (mwRevId: number | null): InboundHead => ({
  mwRevId,
  sha1: null,
  wikitext: "Head.",
  fromClassic: true,
});

/** MediaWiki's parents, by revision. */
let parents: Map<number, number>;

async function quarantine(revid: number, resolved = false) {
  await mockDb.wikiSyncDeadLetter.create({
    data: {
      stepKey: `rc:${revid}`,
      stream: "edits",
      subject: "Caphiria",
      label: "Caphiria",
      mark: "2026-10-24T10:00:00Z",
      payload: { revid, title: "Caphiria" },
      attempts: 5,
      quarantinedAt: new Date(),
      resolvedAt: resolved ? new Date() : null,
    },
  });
}

/** Whether revision `revid` builds on `on` through quarantined revisions. */
const builds = (revid: number, on: InboundHead) => {
  const parentid = parents.get(revid)!;
  return buildsOnHeadPastQuarantine(
    parentid,
    { sha1: "x", parentid: parents.get(parentid) ?? null },
    on
  );
};

describe.each(WIKIOS_MODES)("a revision built on quarantined revisions [%s]", (mode) => {
  let restore: () => void = () => undefined;
  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMemoryPrisma();
    restore = await seedWikiosMode(mockDb, mode);
    // classic: 100 (WikiOS's head) <- 101 <- 102 <- 103
    parents = new Map([
      [101, 100],
      [102, 101],
      [103, 102],
    ]);
    fetchHash.mockImplementation(async (revid) => ({
      sha1: "x",
      parentid: parents.get(revid) ?? null,
    }));
  });
  afterEach(() => restore());

  it("builds on the head when its quarantined parent did", async () => {
    await quarantine(101);
    await expect(builds(102, head(100))).resolves.toBe(true);
    expect(fetchHash).not.toHaveBeenCalled();
  });

  it("follows a chain of quarantined revisions back to the head, a dismissed one included", async () => {
    await quarantine(101, true);
    await quarantine(102);
    await expect(builds(103, head(100))).resolves.toBe(true);
    expect(fetchHash).toHaveBeenCalledWith(101);
  });

  it("is a collision when a revision in between was not quarantined", async () => {
    await quarantine(102);
    await expect(builds(103, head(100))).resolves.toBe(false);
    await expect(builds(102, head(100))).resolves.toBe(false);
  });

  it("is a collision when the chain reaches another revision, or the page's start", async () => {
    await quarantine(101);
    await expect(builds(102, head(99))).resolves.toBe(false);

    parents.set(101, 0);
    await expect(builds(102, head(100))).resolves.toBe(false);
    // the page's first revision has no parent to ask MediaWiki about
    expect(fetchHash).not.toHaveBeenCalledWith(0);
  });

  it("is a collision against an unstamped head, and when MediaWiki does not say the parent", async () => {
    await quarantine(101);
    await expect(builds(102, head(null))).resolves.toBe(false);
    await expect(
      buildsOnHeadPastQuarantine(101, { sha1: null, parentid: null }, head(100))
    ).resolves.toBe(false);
    await expect(
      buildsOnHeadPastQuarantine(101, { sha1: null, parentid: 100 }, null)
    ).resolves.toBe(false);
  });

  it("gives up after ten quarantined revisions in a row", async () => {
    // classic: 100 <- 101 <- ... <- 112, all of 101..111 quarantined
    for (let revid = 101; revid <= 112; revid++) parents.set(revid, revid - 1);
    for (let revid = 101; revid <= 111; revid++) await quarantine(revid);

    await expect(builds(111, head(100))).resolves.toBe(true);
    await expect(builds(112, head(100))).resolves.toBe(false);
  });
});
