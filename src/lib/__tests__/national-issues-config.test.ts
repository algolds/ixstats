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
  getNationalIssuesConfig,
  type NationalIssuesConfig,
} from "~/lib/national-issues-config";

describe("national-issues-config spawnMode", () => {
  it("defaults spawnMode to probability", () => {
    expect(completeNationalIssuesConfig({}).spawnMode).toBe("probability");
  });

  it("merges partial updates without dropping spawnMode", () => {
    const merged = completeNationalIssuesConfig({ maxIssuesPerSession: 7 });
    expect(merged).toEqual({
      maxIssuesPerSession: 7,
      maxIssuesPerWeek: 5,
      spawnMode: "probability",
    } satisfies NationalIssuesConfig);
  });

  it("preserves an explicit spawnMode override", () => {
    expect(
      completeNationalIssuesConfig({ spawnMode: "deterministic" }).spawnMode
    ).toBe("deterministic");
  });

  it("falls back to the default when the JSON file is missing", () => {
    expect(getNationalIssuesConfig().spawnMode).toBe("probability");
  });
});
