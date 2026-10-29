/** @jest-environment node */
/**
 * The per-user log files an account erasure deletes: the user's own file with its rotated and compressed copies, never
 * another user's whose id merely starts the same way.
 */
jest.mock("~/server/db", () => ({ db: {} }));
const readdir = jest.fn();
const unlink = jest.fn();
jest.mock("fs/promises", () => ({
  readdir: () => readdir(),
  unlink: (path: string) => unlink(path),
}));

import { describe, it, expect } from "@jest/globals";
import { ownLogFiles, UserLogger, userLogFileName } from "~/lib/logging/user-logger";

const enoent = () => Object.assign(new Error("gone"), { code: "ENOENT" });

describe("user log files", () => {
  it("names a sanitised file per user", () => {
    expect(userLogFileName("user_2abc")).toBe("user-user_2abc.log");
    expect(userLogFileName("a/../b")).toBe("user-a_.._b.log");
  });

  it("finds the user's file and its rotations only", () => {
    const files = [
      "user-u1.log",
      "user-u1.log.2026-10-01T00-00-00-000Z",
      "user-u1.log.2026-09-01T00-00-00-000Z.gz",
      "user-u10.log",
      "user-u1x.log",
      "other.log",
    ];
    expect(ownLogFiles(files, "u1")).toEqual([
      "user-u1.log",
      "user-u1.log.2026-10-01T00-00-00-000Z",
      "user-u1.log.2026-09-01T00-00-00-000Z.gz",
    ]);
  });
});

describe("UserLogger.deleteUserLogFiles", () => {
  it("deletes each of the user's files, a file already gone counting as deleted", async () => {
    readdir.mockResolvedValue(["user-u1.log", "user-u1.log.1.gz", "user-u2.log"]);
    unlink.mockImplementation(async (path: string) => {
      if (path.endsWith(".gz")) throw enoent();
    });
    await expect(UserLogger.deleteUserLogFiles("u1")).resolves.toBe(2);
    expect(unlink).toHaveBeenCalledTimes(2);
  });

  it("fails on any other error, so the erasure stops and retries", async () => {
    readdir.mockResolvedValue(["user-u1.log"]);
    unlink.mockRejectedValue(Object.assign(new Error("denied"), { code: "EACCES" }));
    await expect(UserLogger.deleteUserLogFiles("u1")).rejects.toThrow("denied");
  });
});
