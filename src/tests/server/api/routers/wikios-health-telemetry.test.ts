/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
// Plan 406 F: the health telemetry reports the real state of the inbound sync, not a constant.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { count: jest.fn().mockResolvedValue(10) },
    wikiAsset: { count: jest.fn().mockResolvedValue(2) },
    wikiRevision: { count: jest.fn().mockResolvedValue(30) },
    wikiLink: { count: jest.fn().mockResolvedValue(40) },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/core/page-management-service", () => ({
  __esModule: true,
  PageManagementService: {
    getOrphanPages: jest.fn().mockResolvedValue([]),
    getDeadEndPages: jest.fn().mockResolvedValue([]),
    getBrokenRedirects: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock("~/lib/wiki-os/rights", () => ({ __esModule: true, getWikiPermissions: jest.fn() }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getSiteStats: jest.fn().mockResolvedValue({
    articles: 0,
    images: 0,
    edits: 0,
    pages: 0,
    users: 0,
    activeUsers: 0,
  }),
}));
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({
  __esModule: true,
  getInboundSyncStatus: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUtilitiesRouter } from "~/server/api/routers/wikios/utilities";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { getInboundSyncStatus } from "~/lib/wiki-os/services/auto-sync-service";

const caller = () =>
  createCallerFactory(wikiosUtilitiesRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("wikios.getHealthTelemetry inbound sync (plan 406)", () => {
  it("reports the status and the last cycle's failures", async () => {
    const status = {
      status: "DEGRADED" as const,
      lastRunAt: "2026-09-27T10:00:00Z",
      failures: 2,
      lastError: "A: MediaWiki returned HTTP 500",
    };
    jest.mocked(getInboundSyncStatus).mockResolvedValue(status);

    const telemetry = await caller().getHealthTelemetry();

    expect(telemetry.inboundSyncStatus).toBe("DEGRADED");
    expect(telemetry.inboundSync).toEqual(status);
  });

  it("says ACTIVE only when the sync says so", async () => {
    jest.mocked(getInboundSyncStatus).mockResolvedValue({
      status: "ACTIVE",
      lastRunAt: "2026-09-27T10:00:00Z",
      failures: 0,
      lastError: null,
    });

    expect((await caller().getHealthTelemetry()).inboundSyncStatus).toBe("ACTIVE");
  });

  it("is UNKNOWN, not ACTIVE, when the status cannot be read", async () => {
    jest.mocked(getInboundSyncStatus).mockRejectedValue(new Error("db down"));

    const telemetry = await caller().getHealthTelemetry();

    expect(telemetry.inboundSyncStatus).toBe("UNKNOWN");
    expect(telemetry.inboundSync).toMatchObject({ lastRunAt: null, failures: 0 });
  });
});
