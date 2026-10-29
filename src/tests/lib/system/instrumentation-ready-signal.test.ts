/** @jest-environment node */
// The PM2 "ready" signal: under `bash start-production.sh` the server inherits an IPC channel PM2 does not read,
// and a send without a callback turned the failed write into an uncaught `write EINVAL` at every start.

jest.mock("~/lib/system/server", () => ({
  ProductionStartup: { initialize: jest.fn(), warmupCaches: jest.fn() },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/api/routers/geo/core", () => ({ warmGeoCache: jest.fn() }));
jest.mock("~/lib/system/node-process-error-handlers", () => ({
  registerNodeProcessErrorHandlers: jest.fn(),
}));
jest.mock("~/lib/achievements/sync", () => ({ syncAchievements: jest.fn() }));

import { registerNode } from "~/instrumentation-node";

describe("registerNode's PM2 ready signal", () => {
  const env = { ...process.env };
  const originalSend = process.send;

  beforeEach(() => {
    process.env = { ...env, NODE_ENV: "production", DATABASE_READONLY: "true" };
  });

  afterEach(() => {
    process.env = env;
    process.send = originalSend;
  });

  it("hands a failed send to a callback instead of throwing or emitting", async () => {
    const send = jest.fn((_message: unknown, callback?: (error: Error | null) => void) => {
      callback?.(Object.assign(new Error("write EINVAL"), { code: "EINVAL" }));
      return false;
    });
    process.send = send as unknown as typeof process.send;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(registerNode()).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledWith("ready", expect.any(Function));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("PM2 ready signal not sent"),
      "write EINVAL"
    );
    warn.mockRestore();
  });
});
