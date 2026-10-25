/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * The inbound sync's dead letters (A5): a step that fails is counted once per cycle; on its fifth failed cycle it is
 * quarantined, and stays so, so the cycle's mark can move past it. A success clears the count (or resolves a quarantined
 * row). An administrator lists the quarantined steps, retries one (a recent change through `syncRevisionById`, a log
 * event through `applyLogEvent`, under the inbound lock, so through the same conflict rule as a cycle) or dismisses it.
 *
 * The table is the in-memory Prisma client; the two appliers and the lock are mocks (the cycle tests in
 * auto-sync-service.test.ts run the real revision sync).
 */
import type { Prisma } from "@prisma/client";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";

let mockDb: MemoryPrisma;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/wiki-os/services/inbound-revision-sync", () => ({
  syncRevisionById: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/inbound-log-events", () => ({ applyLogEvent: jest.fn() }));
jest.mock("~/lib/system/job-lock", () => ({ withJobLock: jest.fn() }));

import { PageOperationError } from "~/lib/wiki-os/core/page-operation-error";
import { syncRevisionById } from "~/lib/wiki-os/services/inbound-revision-sync";
import { applyLogEvent } from "~/lib/wiki-os/services/inbound-log-events";
import { withJobLock } from "~/lib/system/job-lock";
import {
  QUARANTINE_AFTER,
  clearStepFailure,
  countQuarantined,
  dismissQuarantined,
  listQuarantined,
  loadFailingKeys,
  recordStepFailure,
  retryQuarantined,
  type QuarantinableStep,
} from "~/lib/wiki-os/services/inbound-dead-letters";
import { WIKIOS_MODES, seedWikiosMode } from "~/tests/helpers/wikios-modes";

const syncRevision = jest.mocked(syncRevisionById);
const applyEvent = jest.mocked(applyLogEvent);
const lock = jest.mocked(withJobLock);

const rcStep = (revid: number, title = "Caphiria"): QuarantinableStep => ({
  key: `rc:${revid}`,
  stream: "edits",
  subject: title,
  label: title,
  mark: "2026-10-24T10:00:01Z",
  payload: { title, revid, timestamp: "2026-10-24T10:00:01Z" },
});

const deletion = {
  logid: 77,
  type: "delete",
  action: "delete",
  title: "Caphiria",
  user: "Bob",
  timestamp: "2026-10-24T10:00:02Z",
  comment: "spam",
  params: { tags: ["a"] },
  pageId: 12,
};

const logStep: QuarantinableStep = {
  key: "log:77",
  stream: "log",
  subject: "Caphiria",
  label: "delete/delete Caphiria",
  mark: "2026-10-24T10:00:02Z|77",
  payload: deletion,
};

/** Fails `step` in `times` cycles; the last answer. */
async function failTimes(step: QuarantinableStep, times: number, error = "HTTP 500") {
  let last = { quarantined: false, attempts: 0 };
  for (let i = 0; i < times; i++) last = await recordStepFailure(step, error);
  return last;
}

const rowOf = (stepKey: string) => mockDb.wikiSyncDeadLetter.findUnique({ where: { stepKey } });

describe.each(WIKIOS_MODES)("inbound dead letters [%s]", (mode) => {
  let restore: () => void = () => undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMemoryPrisma();
    restore = await seedWikiosMode(mockDb, mode);
    lock.mockImplementation(async (_db, _name, fn) => ({ ran: true, result: await fn() }));
    syncRevision.mockResolvedValue("fast-forward");
    applyEvent.mockResolvedValue("applied");
  });
  afterEach(() => restore());

  describe("recordStepFailure", () => {
    it("counts each failed cycle and quarantines the step on the fifth", async () => {
      expect(QUARANTINE_AFTER).toBe(5);
      await expect(failTimes(rcStep(5), 4)).resolves.toEqual({ quarantined: false, attempts: 4 });
      expect(await rowOf("rc:5")).toMatchObject({ attempts: 4, quarantinedAt: null });

      await expect(recordStepFailure(rcStep(5), "still 500")).resolves.toEqual({
        quarantined: true,
        attempts: 5,
      });
      expect(await rowOf("rc:5")).toMatchObject({
        stream: "edits",
        subject: "Caphiria",
        label: "Caphiria",
        mark: "2026-10-24T10:00:01Z",
        payload: { title: "Caphiria", revid: 5, timestamp: "2026-10-24T10:00:01Z" },
        attempts: 5,
        lastError: "still 500",
        quarantinedAt: expect.any(Date),
        resolvedAt: null,
      });
    });

    it("keeps a quarantined step quarantined when it fails again", async () => {
      await failTimes(rcStep(5), QUARANTINE_AFTER);
      // quarantined a while ago: failing again keeps that time (the list's order)
      const quarantinedAt = new Date("2026-10-01T00:00:00Z");
      await mockDb.wikiSyncDeadLetter.update({
        where: { stepKey: "rc:5" },
        data: { quarantinedAt },
      });

      await expect(recordStepFailure(rcStep(5), "again")).resolves.toEqual({
        quarantined: true,
        attempts: 6,
      });
      expect(await rowOf("rc:5")).toMatchObject({ quarantinedAt, lastError: "again" });
    });

    it("keeps the error to the column's 2,000 characters", async () => {
      await recordStepFailure(rcStep(5), "x".repeat(2_500));
      expect((await rowOf("rc:5"))!.lastError).toHaveLength(2_000);
    });
  });

  describe("clearStepFailure and loadFailingKeys", () => {
    it("a success forgets the count, so the next failure counts from one", async () => {
      await failTimes(rcStep(5), 3);
      await clearStepFailure("rc:5");

      expect(await rowOf("rc:5")).toBeNull();
      await expect(recordStepFailure(rcStep(5), "500")).resolves.toEqual({
        quarantined: false,
        attempts: 1,
      });
    });

    it("a success resolves a quarantined step", async () => {
      await failTimes(rcStep(5), QUARANTINE_AFTER);
      await clearStepFailure("rc:5");

      expect(await rowOf("rc:5")).toMatchObject({ resolvedAt: expect.any(Date) });
      await expect(countQuarantined()).resolves.toBe(0);
    });

    it("knows the steps still failing: counted or quarantined, not resolved", async () => {
      await failTimes(rcStep(1), 2);
      await failTimes(rcStep(2), QUARANTINE_AFTER);
      await failTimes(rcStep(3), QUARANTINE_AFTER);
      await clearStepFailure("rc:3");

      await expect(loadFailingKeys()).resolves.toEqual(new Set(["rc:1", "rc:2"]));
    });
  });

  describe("listQuarantined", () => {
    it("lists the unresolved quarantined steps, oldest first, up to the limit", async () => {
      await failTimes(rcStep(1, "Alpha"), QUARANTINE_AFTER);
      await failTimes(logStep, QUARANTINE_AFTER, "db down");
      await failTimes(rcStep(3, "Gamma"), QUARANTINE_AFTER);
      await failTimes(rcStep(4, "Delta"), 2);
      await clearStepFailure("rc:3");

      const listed = await listQuarantined(10);

      expect(listed.map((step) => step.stepKey)).toEqual(["rc:1", "log:77"]);
      expect(listed[1]).toEqual({
        id: expect.any(String),
        stepKey: "log:77",
        stream: "log",
        subject: "Caphiria",
        label: "delete/delete Caphiria",
        attempts: 5,
        lastError: "db down",
        quarantinedAt: expect.any(Date),
      });
      await expect(listQuarantined(1)).resolves.toHaveLength(1);
      await expect(countQuarantined()).resolves.toBe(2);
    });
  });

  describe("retryQuarantined", () => {
    const quarantined = async (step: QuarantinableStep) => {
      await failTimes(step, QUARANTINE_AFTER);
      return (await rowOf(step.key))!.id;
    };

    it("runs a recent change through syncRevisionById under the inbound lock and resolves the row", async () => {
      const id = await quarantined(rcStep(5));

      await expect(retryQuarantined(id)).resolves.toBe("applied");

      // the memory client answers no matcher, so the call is read field by field
      const [client, name, , options] = lock.mock.calls[0]!;
      expect(client === mockDb).toBe(true);
      expect(name).toBe("wikios-inbound-sync");
      expect(options).toEqual({ timeoutMs: 60_000 });
      expect(syncRevision).toHaveBeenCalledWith(5);
      expect(applyEvent).not.toHaveBeenCalled();
      expect(await rowOf("rc:5")).toMatchObject({ resolvedAt: expect.any(Date) });
      await expect(countQuarantined()).resolves.toBe(0);
    });

    it("runs a log event through applyLogEvent with the event as the cycle read it", async () => {
      const id = await quarantined(logStep);

      await expect(retryQuarantined(id)).resolves.toBe("applied");

      expect(applyEvent).toHaveBeenCalledWith(deletion);
      expect(syncRevision).not.toHaveBeenCalled();
    });

    it("a retry that fails again counts the attempt, keeps the error and leaves the row quarantined", async () => {
      const id = await quarantined(rcStep(5));
      syncRevision.mockRejectedValue(new Error("HTTP 502"));

      await expect(retryQuarantined(id)).resolves.toBe("failed");

      expect(await rowOf("rc:5")).toMatchObject({
        attempts: 6,
        lastError: "HTTP 502",
        quarantinedAt: expect.any(Date),
        resolvedAt: null,
      });
    });

    it("a payload that is not a step's shape fails without running anything", async () => {
      const id = await quarantined(rcStep(5));
      await mockDb.wikiSyncDeadLetter.update({
        where: { id },
        data: { payload: { revid: "five" } as Prisma.InputJsonObject },
      });

      await expect(retryQuarantined(id)).resolves.toBe("failed");

      expect(syncRevision).not.toHaveBeenCalled();
      expect(await rowOf("rc:5")).toMatchObject({ attempts: 6, resolvedAt: null });
    });

    it("refuses a step that is not quarantined, or no longer is", async () => {
      await failTimes(rcStep(1), 2);
      const counting = (await rowOf("rc:1"))!.id;
      const resolved = await quarantined(rcStep(2));
      await clearStepFailure("rc:2");

      for (const id of [counting, resolved, "nope"]) {
        await expect(retryQuarantined(id)).rejects.toEqual(
          new PageOperationError("NOT_FOUND", "No quarantined sync step with that id.")
        );
      }
      expect(syncRevision).not.toHaveBeenCalled();
    });

    it("refuses while a sync holds the lock, running nothing", async () => {
      const id = await quarantined(rcStep(5));
      lock.mockResolvedValue({ ran: false });

      await expect(retryQuarantined(id)).rejects.toEqual(
        new PageOperationError("CONFLICT", "A sync is running. Try again in a moment.")
      );
      expect(syncRevision).not.toHaveBeenCalled();
      expect(await rowOf("rc:5")).toMatchObject({ attempts: 5, resolvedAt: null });
    });
  });

  describe("dismissQuarantined", () => {
    it("gives up on a quarantined step: it leaves the list and stays quarantined if it fails again", async () => {
      await failTimes(rcStep(5), QUARANTINE_AFTER);
      const { id } = (await rowOf("rc:5"))!;

      await dismissQuarantined(id);

      await expect(listQuarantined(10)).resolves.toEqual([]);
      await expect(recordStepFailure(rcStep(5), "500")).resolves.toMatchObject({
        quarantined: true,
      });
      await expect(countQuarantined()).resolves.toBe(0);
    });

    it("refuses a step that is not quarantined", async () => {
      await failTimes(rcStep(5), 2);
      const { id } = (await rowOf("rc:5"))!;

      await expect(dismissQuarantined(id)).rejects.toEqual(
        new PageOperationError("NOT_FOUND", "No quarantined sync step with that id.")
      );
      expect(await rowOf("rc:5")).toMatchObject({ resolvedAt: null });
    });
  });
});
