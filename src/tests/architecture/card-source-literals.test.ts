/**
 * Card code names its source wikis through `~/lib/cards/card-sources` (cards refresh spec §2.4: one importer for
 * IxWiki, IIWiki, AltHistory and Commons), never a hard-coded two-wiki list that leaves AltHistory out.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const CARD_CODE = [
  "lib/cards",
  "server/modules/cards",
  "server/api/routers/cards",
  "server/api/routers/lore-cards",
  "server/api/routers/card-packs",
  "app/admin/cards",
  "components/cards",
];
const TWO_WIKI_LIST =
  /\[\s*["']ixwiki["']\s*,\s*["']iiwiki["']\s*\]|["']ixwiki["']\s*\|\s*["']iiwiki["'](?!\s*\|)/;

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

it("has no two-wiki source list in card code", () => {
  const offenders = CARD_CODE.flatMap((dir) => filesUnder(path.join(ROOT, dir)))
    .filter((file) => !file.endsWith("card-sources.ts"))
    .filter((file) => TWO_WIKI_LIST.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(ROOT, file));
  expect(offenders).toEqual([]);
});
