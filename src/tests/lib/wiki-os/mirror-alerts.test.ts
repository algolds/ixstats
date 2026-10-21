/** @jest-environment node */
/**
 * Plan 407: the dead-job warning is one Discord message, at most once in 30 minutes, about every job that went dead
 * since the last one.
 */
import {
  alertDeadJobs,
  ATTEMPT_BACKOFF_MS,
  ATTEMPT_KEY,
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
  discordWebhook: { isEnabled: jest.fn(), sendWarning: jest.fn() },
}));

const warn = jest.mocked(discordWebhook.sendWarning);
const isEnabled = jest.mocked(discordWebhook.isEnabled);
const NOW = new Date("2026-10-01T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const job = (title: string, lastError: string | null = "MediaWiki 503") => ({
  kind: "revision",
  title,
  lastError,
});

beforeEach(() => {
  jest.clearAllMocks();
  isEnabled.mockReturnValue(true);
  warn.mockResolvedValue(true); // Discord delivers
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

  describe("when Discord does not deliver the warning", () => {
    /** SystemConfig as a keyed store, so the stamps of one call are what the next call reads. */
    const config = new Map<string, string>();
    const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

    beforeEach(() => {
      config.clear();
      mockConfigFind.mockImplementation(async ({ where }: { where: { key: string } }) =>
        config.has(where.key) ? { value: config.get(where.key) } : null
      );
      mockConfigUpsert.mockImplementation(async ({ where, update }: { where: { key: string }; update: { value: string } }) => {
        config.set(where.key, update.value);
      });
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue([job("Foo")]);
      warn.mockResolvedValue(false); // down, refused, or not reachable
    });
    it("backs off 5 minutes after a failed attempt, so a dead webhook is not tried in every cycle", async () => {
      expect(ATTEMPT_BACKOFF_MS).toBe(5 * 60_000);
      await alertDeadJobs(NOW);

      await alertDeadJobs(minutes(1));
      await alertDeadJobs(minutes(4));
      expect(warn).toHaveBeenCalledTimes(1); // held back, without even looking for jobs again
      expect(mockCount).toHaveBeenCalledTimes(1);

      await alertDeadJobs(minutes(5));
      expect(warn).toHaveBeenCalledTimes(2);
      expect(config.get(ATTEMPT_KEY)).toBe(minutes(5).toISOString()); // and the back-off starts again
    });
  });

  it("looks up nothing and sends nothing when no Discord webhook is configured", async () => {
    isEnabled.mockReturnValue(false);
    mockCount.mockResolvedValue(2);

    await alertDeadJobs(NOW);

    expect(mockConfigFind).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(mockConfigUpsert).not.toHaveBeenCalled();
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
  it("holds the warning back for 30 minutes after the last one, without even looking for jobs", async () => {
    mockConfigFind.mockResolvedValue({ value: minutesAgo(29).toISOString() });
    mockCount.mockResolvedValue(3);

    await alertDeadJobs(NOW);

    expect(warn).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockConfigUpsert).not.toHaveBeenCalled();
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
