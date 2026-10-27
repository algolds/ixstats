/** @jest-environment node */
/**
 * Native lore's error states use the semantic destructive tokens, like the rest of lore, never a raw palette colour
 * (`text-red`, `bg-red/10`), which skips the theme's contrast-checked values.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = [
  "src/components/country-profile/lore",
  "src/components/country-profile/LoreTeam.tsx",
];

function files(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

const RAW_COLOUR =
  /\b(?:text|bg|border|ring|outline|fill|stroke)-(?:red|green|amber|yellow|blue|orange|rose)(?:-\d{2,3})?(?:\/\d+)?\b/g;

describe("lore colour tokens", () => {
  it.each(ROOTS.flatMap(files).filter((file) => file.endsWith(".tsx")))(
    "%s uses no raw palette colour",
    (file) => {
      expect(readFileSync(file, "utf8").match(RAW_COLOUR) ?? []).toEqual([]);
    }
  );
});
