/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IIWIKI_FEATURE_IDS } from "~/lib/wiki-os/iiwiki-switch";
import { IIWIKI_TOUCHPOINTS } from "~/lib/wiki-os/iiwiki-touchpoints";

const ROOT = join(__dirname, "../../../..");
/** A call to the switch, or a feature literal handed to a gated helper (`feature: "cards"`, a trailing `"realms"`). */
const SWITCH_CHECK = new RegExp(
  `assertIiwikiAllowed\\(|iiwikiAllows\\(|iiwikiSourceAllowed\\(|"(?:${IIWIKI_FEATURE_IDS.join("|")})"`
);

describe("IIWIKI_TOUCHPOINTS", () => {
  it("names files that exist, with unique ids", () => {
    const missing = IIWIKI_TOUCHPOINTS.filter((t) => !existsSync(join(ROOT, t.file))).map(
      (t) => t.file
    );
    expect(missing).toEqual([]);
    const ids = IIWIKI_TOUCHPOINTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts every feature of the switch on at least one touchpoint", () => {
    const covered = new Set(IIWIKI_TOUCHPOINTS.map((t) => t.feature));
    expect(IIWIKI_FEATURE_IDS.filter((id) => !covered.has(id))).toEqual([]);
  });

  it("keeps the switch check in every touchpoint that cannot go through the guard", () => {
    const unchecked = IIWIKI_TOUCHPOINTS.filter(
      (t) => t.gate === "assert" && !SWITCH_CHECK.test(readFileSync(join(ROOT, t.file), "utf8"))
    ).map((t) => t.file);
    expect(unchecked).toEqual([]);
  });
});
