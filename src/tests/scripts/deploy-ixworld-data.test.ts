import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/deploy-ixworld.sh", "utf8");

describe("deploy-ixworld.sh copies data/ without the tile cache", () => {
  it("excludes the default tile folder from the data/ rsync, which has no --delete", () => {
    const line = script.split("\n").find((l) => /rsync .* data\/ "\$IXWORLD_DIR\/data\/"/.test(l));
    expect(line).toBeDefined();
    expect(line).toContain("--exclude '/cache/map-tiles'");
    expect(line).not.toContain("--delete");
  });
});
