/** @jest-environment node */
/**
 * Realm time D1: the defense budget is the National budget's Defense department line, and the
 * legacy security tables (never written, all defaults) are dropped. No schema, code, test, seed or
 * script may name them again, as a Prisma model, a client delegate (or a mocked one) or a security
 * procedure. (`borderSecurity` alone is the derived threat picture's score and stays.)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const SELF = relative(ROOT, __filename);
const DROPPED = [
  "SecurityAssessment",
  "BorderSecurity",
  "NeighborThreatAssessment",
  "SecurityThreat",
  "ThreatIncident",
  "SecurityEvent",
  "DefenseBudget",
];
const delegate = (model: string) => model[0]!.toLowerCase() + model.slice(1);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return /\.(tsx?|mjs|cjs|js|prisma)$/.test(entry.name) ? [path] : [];
  });
}

const files = ["src", "scripts", "prisma/schema"]
  .flatMap((dir) => walk(join(ROOT, dir)))
  .map((file) => ({ file: relative(ROOT, file), text: readFileSync(file, "utf8") }))
  .filter(({ file }) => file !== SELF);

const hits = (pattern: RegExp) =>
  files.flatMap(({ file, text }) =>
    Array.from(
      text.matchAll(new RegExp(pattern.source, "g")),
      (m) => `${file}:${text.slice(0, m.index).split("\n").length}`
    )
  );

describe("dropped legacy security tables", () => {
  it.each(DROPPED)("%s is not a model, type or delegate anywhere", (model) => {
    expect(
      hits(
        new RegExp(
          `\\b${model}\\b|\\b(db|tx|prisma)\\.${delegate(model)}\\b|\\b${delegate(model)}: \\{`
        )
      )
    ).toEqual([]);
  });

  it("the security router serves no defense budget of its own", () => {
    expect(hits(/\b(getDefenseBudget|upsertDefenseBudget)\b/)).toEqual([]);
  });
});
