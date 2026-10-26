/** @jest-environment node */
/**
 * Which procedure builder a router may use. M0 #19: every signed-in mutation is rate-limited, so a mutation built on
 * bare protectedProcedure / premiumProcedure (no limit at all) uses rateLimitedMutationProcedure,
 * premiumMutationProcedure, lightMutationProcedure, standardMutationCountryOwnerProcedure or adminProcedure instead.
 * Cards refresh spec §2.4, §3: every card admin procedure is admin-only and lives under cards.admin.
 *
 * Folds cards-admin-gate.
 */
import fs from "fs";
import path from "path";

const ROUTERS = path.resolve(__dirname, "../../server/api/routers");

/** Directories not yet converted, with the reason. Shrink-only. */
// Router directories still allowed bare mutations, each with its reason. Empty since WikiOS's personal writes
// (annotations, watchlist, stash) took rate-limited builders.
const ALLOWLIST: Record<string, string> = {};

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

  if (Object.keys(ALLOWLIST).length > 0) {
    it.each(Object.keys(ALLOWLIST))(
      "allowlisted %s still needs converting (remove it once it does not)",
      (dir) => {
        expect(walk(path.join(ROUTERS, dir)).flatMap(unlimitedMutations).length).toBeGreaterThan(0);
      }
    );
  }
});

describe("card admin procedures", () => {
  const OTHER_BUILDERS =
    /\b(publicProcedure|protectedProcedure|premiumProcedure|rateLimitedMutationProcedure|rateLimitedPublicProcedure|lightMutationProcedure|readOnlyProcedure|wikiReadProcedure|countryOwnerProcedure)\b/;
  const read = (file: string) => fs.readFileSync(file, "utf8");

  it("cards/admin builds every procedure on adminProcedure", () => {
    const files = walk(path.join(ROUTERS, "cards/admin"));
    expect(files.length).toBeGreaterThanOrEqual(12);
    expect(files.filter((file) => OTHER_BUILDERS.test(read(file)))).toEqual([]);
  });

  it("no card router outside cards/admin holds an admin procedure", () => {
    const files = ["cards", "lore-cards", "card-packs", "ns-import"].flatMap((dir) =>
      fs
        .readdirSync(path.join(ROUTERS, dir))
        .filter((file) => file.endsWith(".ts"))
        .map((file) => path.join(ROUTERS, dir, file))
    );
    expect(files.filter((file) => /\badminProcedure\b/.test(read(file)))).toEqual([]);
  });
});
