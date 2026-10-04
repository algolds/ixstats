import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const BASELINE = path.join(__dirname, "facet-ratchet.baseline.json");
const DIRS = ["src/components", "src/app"];
const UPDATE_HINT = "run UPDATE_FACET_RATCHET=1 bun run test -- facet-ratchet";

/** Each tell the sweep removes. Counts are matches on non-comment lines of .tsx files. */
const TELLS: Record<string, RegExp> = {
  eyebrow: /<Eyebrow\b|\btext-eyebrow\b/g,
  statLabel: /\btext-stat-label\b/g,
  emDash: /—/g,
  sparks: /\bSparks\b/g,
  emoji: /\p{Extended_Pictographic}/gu,
  hoverScale: /\bhover:scale-/g,
  hexClass: /\[#[0-9a-fA-F]{3,8}\]/g,
  rawPalette:
    /\b(?:bg|text|border|from|via|to|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
  animatePing: /\banimate-ping\b/g,
};

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith(".tsx") ? [p] : [];
  });
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\s*\/\*)/.test(line);

function count(): Record<string, number> {
  const totals = Object.fromEntries(Object.keys(TELLS).map((k) => [k, 0]));
  for (const file of DIRS.flatMap((d) => walk(path.join(ROOT, d)))) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (isComment(line)) continue;
      for (const [name, re] of Object.entries(TELLS)) totals[name]! += line.match(re)?.length ?? 0;
    }
  }
  return totals;
}

describe("Facet ratchet: AI-design tells only go down", () => {
  const now = count();

  if (process.env.UPDATE_FACET_RATCHET) {
    fs.writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")) as Record<string, number>;

  it.each(Object.keys(TELLS))("%s", (name) => {
    const was = baseline[name] ?? 0;
    const is = now[name] ?? 0;
    expect({ name, is, was, ok: is <= was }).toMatchObject({ ok: true });
    // A drop must be locked in so it cannot creep back.
    if (is < was) {
      throw new Error(`${name} fell from ${was} to ${is}; lock it in: ${UPDATE_HINT}`);
    }
  });
});
