/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import {
  deleteKeysByPattern,
  getSharedRedis,
  type ScanDeleteClient,
} from "~/lib/cache/redis-client";

describe("deleteKeysByPattern", () => {
  it("walks the SCAN cursor to 0 and unlinks each batch", async () => {
    const scan = jest
      .fn<ReturnType<ScanDeleteClient["scan"]>, Parameters<ScanDeleteClient["scan"]>>()
      .mockResolvedValueOnce(["5", ["a", "b"]])
      .mockResolvedValueOnce(["0", ["c"]]);
    const unlink = jest.fn(async (...keys: string[]) => keys.length);

    const total = await deleteKeysByPattern({ scan, unlink }, "acs:*");

    expect(total).toBe(3);
    expect(unlink).toHaveBeenCalledTimes(2);
    expect(scan.mock.calls.map((call) => call[0])).toEqual(["0", "5"]);
    expect(scan).toHaveBeenCalledWith("0", "MATCH", "acs:*", "COUNT", 250);
  });
});

describe("getSharedRedis", () => {
  it("returns null when Redis is not enabled", () => {
    delete process.env.REDIS_ENABLED;
    expect(getSharedRedis()).toBeNull();
  });
});
