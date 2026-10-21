// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
import { describe, it, expect } from "@jest/globals";

jest.mock("fs", () => ({
  existsSync: () => false,
  mkdirSync: () => undefined,
  writeFileSync: () => undefined,
  readFileSync: () => "{}",
}));
jest.mock("path", () => ({
  dirname: () => ".",
  join: () => "data/national-issues-config.json",
}));

import {
  completeNationalIssuesConfig,
  type NationalIssuesConfig,
} from "~/lib/national-issues/config";

describe("national-issues-config spawnMode", () => {
  it("merges partial updates without dropping spawnMode", () => {
    const merged = completeNationalIssuesConfig({ maxIssuesPerSession: 7 });
    expect(merged).toEqual({
      maxIssuesPerSession: 7,
      maxIssuesPerWeek: 5,
      spawnMode: "probability",
    } satisfies NationalIssuesConfig);
  });
});
