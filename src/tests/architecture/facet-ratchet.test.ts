import fs from "fs";
import path from "path";
import { TELLS, isComment, walkTsx } from "./facet-tells";

const ROOT = path.resolve(__dirname, "../../..");
const BASELINE = path.join(__dirname, "facet-ratchet.baseline.json");
const DIRS = ["src/components", "src/app"];
const UPDATE_HINT = "run UPDATE_FACET_RATCHET=1 bun run test -- facet-ratchet";

function count(): Record<string, number> {
  const totals = Object.fromEntries(Object.keys(TELLS).map((k) => [k, 0]));
  for (const file of DIRS.flatMap((d) => walkTsx(path.join(ROOT, d)))) {
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
