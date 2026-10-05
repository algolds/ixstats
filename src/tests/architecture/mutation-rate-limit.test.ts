import fs from "fs";
import path from "path";

/**
 * M0 #19: every signed-in mutation is rate-limited. A mutation built on bare
 * protectedProcedure / premiumProcedure has no limit at all; use rateLimitedMutationProcedure,
 * premiumMutationProcedure, lightMutationProcedure, standardMutationCountryOwnerProcedure or
 * adminProcedure instead.
 */
const ROUTERS = path.resolve(__dirname, "../../server/api/routers");

/** Directories not yet converted, with the reason. Shrink-only. */
const ALLOWLIST: Record<string, string> = {
  wikios: "Rewritten by the open WikiOS v1 PR (#52); convert when it lands (roadmap D20).",
};

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.name.endsWith(".ts") ? [full] : [];
  });
}

/** `name: protectedProcedure ... .mutation(` chains, as file:line strings. */
function unlimitedMutations(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  const found: string[] = [];
  for (const match of source.matchAll(
    /(?:\w+\s*:|=)\s*\b(protectedProcedure|premiumProcedure)\b/g
  )) {
    const rest = source.slice(match.index! + match[0].length);
    const next = /\.(query|mutation|subscription)\(/.exec(rest);
    if (next?.[1] === "mutation") {
      const line = source.slice(0, match.index).split("\n").length;
      found.push(`${path.relative(ROUTERS, file)}:${line}`);
    }
  }
  return found;
}

describe("signed-in mutations are rate-limited", () => {
  it("no router mutation uses bare protectedProcedure or premiumProcedure", () => {
    const offenders = walk(ROUTERS)
      .filter((file) => !(path.relative(ROUTERS, file).split(path.sep)[0]! in ALLOWLIST))
      .flatMap(unlimitedMutations);
    expect(offenders).toEqual([]);
  });

  it("allowlisted directories still need converting (remove them once they do not)", () => {
    for (const dir of Object.keys(ALLOWLIST)) {
      expect(walk(path.join(ROUTERS, dir)).flatMap(unlimitedMutations).length).toBeGreaterThan(0);
    }
  });
});
