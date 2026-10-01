/** @jest-environment node */
/**
 * Plan 407: the dead-job warning is one Discord message, at most once in 30 minutes, about every job that went dead
 * since the last one.
 */
import {
  alertDeadJobs,
  DEAD_ALERT_INTERVAL_MS,
  DEAD_ALERT_KEY,
} from "~/lib/wiki-os/services/mirror-alerts";
import { discordWebhook } from "~/lib/discord/webhook";

const mockConfigFind = jest.fn();
const mockConfigUpsert = jest.fn();
const mockCount = jest.fn();
const mockFindMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    systemConfig: {
      findUnique: (...a: unknown[]) => mockConfigFind(...a),
      upsert: (...a: unknown[]) => mockConfigUpsert(...a),
    },
    wikiMirrorJob: {
      count: (...a: unknown[]) => mockCount(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
  },
}));
jest.mock("~/lib/discord/webhook", () => ({
  discordWebhook: { sendWarning: jest.fn().mockResolvedValue(undefined) },
}));

const warn = jest.mocked(discordWebhook.sendWarning);
const NOW = new Date("2026-10-01T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const job = (title: string, lastError: string | null = "MediaWiki 503") => ({
  kind: "revision",
  title,
  lastError,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockConfigFind.mockResolvedValue(null);
  mockCount.mockResolvedValue(0);
  mockFindMany.mockResolvedValue([]);
});

describe("alertDeadJobs", () => {
  it("is silent, and writes nothing, when no job went dead", async () => {
    await alertDeadJobs(NOW);

    expect(warn).not.toHaveBeenCalled();
    expect(mockConfigUpsert).not.toHaveBeenCalled();
  });

  it("tells one dead job as `<kind> <title>: <error>`, and remembers when", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([job("Foo")]);

    await alertDeadJobs(NOW);

    expect(warn).toHaveBeenCalledWith("WikiOS mirror job dead", "revision Foo: MediaWiki 503");
    expect(mockConfigUpsert).toHaveBeenCalledWith({
      where: { key: DEAD_ALERT_KEY },
      create: { key: DEAD_ALERT_KEY, value: NOW.toISOString() },
      update: { value: NOW.toISOString() },
    });
  });

  it("tells several as one message: the count, the newest few, the number left out", async () => {
    mockCount.mockResolvedValue(8);
    mockFindMany.mockResolvedValue(["A", "B", "C", "D", "E"].map((title) => job(title)));

    await alertDeadJobs(NOW);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toEqual([
      "WikiOS mirror jobs dead",
      [
        "8 mirror jobs went dead since the last warning:",
        "revision A: MediaWiki 503",
        "revision B: MediaWiki 503",
        "revision C: MediaWiki 503",
        "revision D: MediaWiki 503",
        "revision E: MediaWiki 503",
        "...and 3 more",
      ].join("\n"),
    ]);
  });

  it("asks only for the newest five, newest first, of the dead jobs since the last warning", async () => {
    mockConfigFind.mockResolvedValue({ value: minutesAgo(45).toISOString() });
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([job("Foo")]);

    await alertDeadJobs(NOW);

    const where = { source: "ixwiki", state: "dead", updatedAt: { gt: minutesAgo(45) } };
    expect(mockCount).toHaveBeenCalledWith({ where });
    expect(mockFindMany).toHaveBeenCalledWith({
      where,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { kind: true, title: true, lastError: true },
    });
  });

  it("holds the warning back for 30 minutes after the last one, without even looking for jobs", async () => {
    mockConfigFind.mockResolvedValue({ value: minutesAgo(29).toISOString() });
    mockCount.mockResolvedValue(3);

    await alertDeadJobs(NOW);

    expect(warn).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockConfigUpsert).not.toHaveBeenCalled();
  });

  it("warns again once 30 minutes have passed", async () => {
    expect(DEAD_ALERT_INTERVAL_MS).toBe(30 * 60_000);
    mockConfigFind.mockResolvedValue({ value: minutesAgo(30).toISOString() });
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([job("Foo")]);

    await alertDeadJobs(NOW);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("treats a stored time it cannot read as no warning ever sent, and then looks at every dead job", async () => {
    mockConfigFind.mockResolvedValue({ value: "not a time" });
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([job("Foo")]);

    await alertDeadJobs(NOW);

    expect(mockCount).toHaveBeenCalledWith({ where: { source: "ixwiki", state: "dead" } });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps each job's line short: Discord's description is limited and an error can be 2000 characters", async () => {
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue([job("A", "x".repeat(2_000)), job("B", null)]);

    await alertDeadJobs(NOW);

    const lines = (warn.mock.calls[0]?.[1] ?? "").split("\n").slice(1);
    expect(lines[0]).toHaveLength(300);
    expect(lines[1]).toBe("revision B: (no error recorded)");
  });
});
