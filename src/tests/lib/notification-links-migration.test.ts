/** @jest-environment node */
/**
 * The migration that rewrites stored notification links to legacy URLs. It only rewrites "Notification"."href", one
 * PostgreSQL regexp_replace per statement; this test runs those statements, in order, on example links in JS.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "20261028120000_rewrite_legacy_notification_links";
const lines = readFileSync(`prisma/migrations/${DIR}/migration.sql`, "utf8").split("\n");

const UPDATE =
  /^UPDATE "Notification" SET "href" = regexp_replace\("href", '([^']+)', '([^']+)'\) WHERE "href" ~ '([^']+)';$/;

const statements = lines.filter((line) => line.trim() !== "" && !line.startsWith("--"));
const rewrites = statements.map((line) => {
  const [, pattern = "", replacement = "", where = ""] = UPDATE.exec(line) ?? [];
  return { pattern, replacement, where, regex: new RegExp(pattern) };
});

/** One run of the file: each statement, in order, on a link its pattern matches (PostgreSQL's `\1` is JS's `$1`). */
function migrate(href: string): string {
  return rewrites.reduce(
    (link, { regex, replacement }) =>
      regex.test(link) ? link.replace(regex, replacement.replace(/\\([1-9])/g, "$$$1")) : link,
    href
  );
}

const BASE = "/projects/ixstates";

/** Legacy links and where the migration sends them. */
const MOVED: ReadonlyArray<readonly [string, string]> = [
  ["/projects/ixstats/thinkpages/forum", "/thinkpages"],
  ["/projects/ixstats/mycountry", "/mycountry"],
  ["/projects/ixstats", "/"],
  ["/projects/ixstats?x=1", "/?x=1"],
  [`${BASE}/projects/ixstats/vault`, `${BASE}/vault`],
  ["/thinkpages/forum", "/thinkpages"],
  ["/thinkpages/forum#standing", "/thinkpages#standing"],
  ["/thinkpages/forum?tab=new", "/thinkpages?tab=new"],
  ["/thinkpages/forum?realm=eurth", "/thinkpages/r/eurth/hub"],
  ["/thinkpages/forum?realm=eurth&x=1#standing", "/thinkpages/r/eurth/hub#standing"],
  ["/thinkpages?realm=eurth", "/thinkpages/r/eurth/hub"],
  ["/thinkpages?realm=ixworld", "/thinkpages/r/ixnay/hub"],
  ["/thinkpages/forum?realm=ixworld", "/thinkpages/r/ixnay/hub"],
  ["/thinkpages/feed", "/dashboard"],
  ["/thinkpages/feed?post=7", "/dashboard?post=7"],
  ["/thinkpages/saved", "/dashboard/saved"],
  ["/thinkpages/profile/kaiser", "/dashboard/profile/kaiser"],
  ["/thinkpages/thinkshare", "/messages"],
  ["/thinkpages/thinktanks", "/thinktanks"],
  ["/thinkpages/stashed", "/stashes"],
  ["/thinkpages/r/ixworld", "/thinkpages/r/ixnay"],
  ["/thinkpages/r/ixworld/hub", "/thinkpages/r/ixnay/hub"],
  ["/r/ixworld", "/r/ixnay"],
  ["/r/ixworld/nations", "/r/ixnay/nations"],
  ["/r/eurth/board", "/thinkpages/r/eurth"],
  ["/r/ixworld/board", "/thinkpages/r/ixnay"],
  ["/id/@kaiser", "/@kaiser"],
  ["/id/@kaiser/work", "/@kaiser?tab=work"],
  ["/@kaiser/work", "/@kaiser?tab=work"],
  ["/@kaiser/work?from=wiki", "/@kaiser?tab=work&from=wiki"],
  ["/profile", "/settings"],
  ["/profile/notifications", "/settings"],
  ["/profile/notifications?tab=email#top", "/settings?tab=email#top"],
  ["/achievements", "/vault/achievements"],
  ["/achievements?a=first_steps", "/vault/achievements?a=first_steps"],
  ["/vault/exchange", "/labs/exchange"],
  ["/vault/marketplace", "/vault/store"],
  ["/vault/marketplace?tab=trading", "/vault/store?tab=trading"],
  ["/vault/market", "/vault/store?tab=auctions"],
  ["/vault/market?card=7", "/vault/store?tab=auctions&card=7"],
  ["/vault/packs", "/vault/store?tab=store"],
  ["/vault/packs?pack=gold", "/vault/store?tab=store&pack=gold"],
  ["/vault/trading", "/vault/store?tab=trading"],
  ["/vault/trading?offer=3", "/vault/store?tab=trading&offer=3"],
  ["/builder/import", "/builder?import=1"],
  ["/builder/import?from=wiki", "/builder?import=1&from=wiki"],
  ["/mycountry/builder?section=import", "/builder?import=1"],
  ["/mycountry/builder?section=import#wiki", "/builder?import=1#wiki"],
  ["/mycountry/builder/?section=import&from=wiki", "/builder?import=1&from=wiki"],
  ["/mycountry/builder?section=imports", "/builder?section=imports"],
  ["/mycountry/builder", "/builder"],
  ["/countries/caphiria/factbook", "/countries/caphiria"],
  ["/explore", "/countries"],
  ["/explore?q=urcea", "/countries?q=urcea"],
  ["/forum/conversations", "/messages"],
  ["/forum/conversations/42", "/messages"],
  ["/forum", "/thinkpages"],
  ["/forum/", "/thinkpages"],
  ["/forum/search", "/thinkpages"],
  ["/forum/new-thread", "/thinkpages"],
  ["/forum/bookmarks", "/thinkpages"],
];

/** Live links, some sharing a legacy link's prefix, that the migration leaves alone. */
const KEPT = [
  "/forum/thread/12",
  "/forum/post/9",
  "/forum/12",
  "/forum/members/5",
  "/dashboard/profile/x",
  "/thinkpages",
  "/thinkpages/forum-x",
  "/thinkpages/r/ixnay/hub",
  "/vault/store?tab=store",
  "/vault/achievements?a=first_steps",
  "/explore/collections",
  "/countries/caphiria/factbook/economy",
  "/settings/profile",
  "/@kaiser",
  "/@kaiser?tab=work",
  "/id/kaiser",
  "/r/ixnay/nations",
  "/myclub/abc",
  "https://ixwiki.com/wiki/Main_Page",
];

/** A root-relative example the production basePath can go in front of (not one already under a basePath). */
const underBase = (href: string): boolean => href.startsWith("/") && !href.startsWith("/projects/");

/** Every example again, as NotificationAPI stores it in production: under the basePath. */
const ALL_MOVED = [
  ...MOVED,
  ...MOVED.filter(([legacy]) => underBase(legacy)).map(
    ([legacy, current]) => [`${BASE}${legacy}`, `${BASE}${current}`] as const
  ),
];
const ALL_KEPT = [...KEPT, ...KEPT.filter(underBase).map((href) => `${BASE}${href}`)];

describe("rewrite legacy notification links migration", () => {
  it("sorts after the forum readers drop", () => {
    const dirs = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    expect(dirs.indexOf("20261027120000_drop_forum_readers")).toBeGreaterThan(-1);
    expect(dirs.indexOf(DIR)).toBeGreaterThan(dirs.indexOf("20261027120000_drop_forum_readers"));
  });

  it("only updates Notification.href, each statement filtered by its own pattern and under a comment", () => {
    expect(statements.length).toBeGreaterThan(0);
    for (const line of statements) expect(line).toMatch(UPDATE);
    for (const { pattern, where } of rewrites) expect(where).toBe(pattern);
    const above = lines.flatMap((line, i) => (line.startsWith("UPDATE") ? [lines[i - 1]] : []));
    expect(above).toHaveLength(statements.length);
    for (const comment of above) expect(comment).toMatch(/^-- \S/);
  });

  it("uses only regex syntax that reads the same in PostgreSQL and JS", () => {
    for (const { pattern, replacement } of rewrites) {
      // The only escape is `\?`; no `.`, `{}` or lookbehind, whose meaning could differ.
      expect(pattern.replace(/\\\?/g, "")).not.toMatch(/[\\.{}]|\(\?</);
      // Back-references only; a `$` would be special in JS.
      expect(replacement).not.toMatch(/\$|\\[^1-9]/);
    }
  });

  it.each(ALL_MOVED)("rewrites %s to %s", (legacy, current) => {
    expect(migrate(legacy)).toBe(current);
  });

  it.each(ALL_KEPT)("leaves %s alone", (href) => {
    expect(migrate(href)).toBe(href);
  });

  it("changes nothing on a second run", () => {
    for (const [, current] of ALL_MOVED) expect(migrate(current)).toBe(current);
  });

  it("has no statement that no example exercises", () => {
    for (const { regex } of rewrites) {
      expect(MOVED.some(([legacy]) => regex.test(legacy))).toBe(true);
    }
  });
});
