import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const BASELINE = path.join(__dirname, "use-state-ratchet.baseline.json");
const UPDATE_HINT = "run UPDATE_USE_STATE_RATCHET=1 bun run test -- use-state-ratchet";

/**
 * Past this many `useState` calls in one file, the state wants modelling: one `useReducer` over a
 * discriminated union (see src/lib/maps/province-importer/importer-state.ts), state derived from the
 * address or the server, or a split. Files already over it are listed in the baseline and may only fall.
 */
const MAX_PER_FILE = 5;
const USE_STATE = /\buseState\s*[<(]/g;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

function countOverCap(): Record<string, number> {
  const over: Record<string, number> = {};
  for (const file of walk(path.join(ROOT, "src"))) {
    const n = fs.readFileSync(file, "utf8").match(USE_STATE)?.length ?? 0;
    if (n > MAX_PER_FILE) over[path.relative(ROOT, file)] = n;
  }
  return over;
}

describe("useState ratchet: files past the cap only shrink", () => {
  const now = countOverCap();

  if (process.env.UPDATE_USE_STATE_RATCHET) {
    const sorted = Object.fromEntries(Object.entries(now).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")) as Record<string, number>;

  it("no file grows past its baseline, and no new file passes the cap", () => {
    const grew = Object.entries(now)
      .filter(([file, n]) => n > (baseline[file] ?? MAX_PER_FILE))
      .map(([file, n]) => `${file}: ${n} (allowed ${baseline[file] ?? MAX_PER_FILE})`);
    expect(grew).toEqual([]);
  });

  it("drops are locked in", () => {
    const fell = Object.entries(baseline)
      .filter(([file, was]) => (now[file] ?? 0) < was)
      .map(([file, was]) => `${file}: ${was} -> ${now[file] ?? 0}`);
    if (fell.length > 0) throw new Error(`${fell.join("\n")}\nlock it in: ${UPDATE_HINT}`);
  });
});
