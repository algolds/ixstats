/** @jest-environment node */
// Help pages for accounts, the Vault and Lorewards call the wiki "the wiki" (WikiOS names the reader); the only
// "IxWiki" left is the `IxWiki:` project-namespace page name, which is a real page title.
import { readFileSync } from "node:fs";
import path from "node:path";

const HELP = path.join(process.cwd(), "src/content/help");
const FILES = [
  "getting-started/ixnayid.md",
  "getting-started/settings.md",
  "gameplay/achievements.md",
  "wiki/lorewards.md",
  "vault/lore-cards.md",
  "vault/overview.md",
  "vault/ixcredits.md",
];

describe("help copy: the wiki, not IxWiki", () => {
  it.each(FILES)("%s has no IxWiki outside the IxWiki: namespace", (file) => {
    const text = readFileSync(path.join(HELP, file), "utf8").replace(/IxWiki:/g, "");
    expect(text).not.toMatch(/IxWiki/);
  });
});
