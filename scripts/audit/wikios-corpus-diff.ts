/**
 * scripts/audit/wikios-corpus-diff.ts — the text functions of src/lib/wiki-os, old against new, on real pages.
 *
 * The regex-DoS sweep (plan F15) rewrote scanners and regular-expression passes, and every rewrite is held
 * against the code it replaced on random token soups (tests/lib/wiki-os/regex-dos-*.test.ts). This holds
 * them against real pages too: the same function of an OLD checkout and of this tree is run on every page of
 * a corpus and the answers are compared with `isDeepStrictEqual`. The functions are the ones the fuzz script
 * lists (wikios-regex-fuzz-targets.ts, copied into the old checkout so both run the same drivers); two more
 * that had no home in the old tree are compared against a verbatim copy of the old code below.
 *
 * The corpus is a folder of JSON-lines files (one `{ id, title?, text }` per line; `articles-renderedview.jsonl`
 * has `body`, `infobox` and `notices`): articles-wikitext, revisions-wikitext, articles-contenthtml,
 * articles-renderedview, as dumped from a clone of the wiki with read-only SELECTs. The HTML a function that
 * reads HTML is fed is the corpus's own, and the old compiler's HTML of every wikitext page.
 *
 * Usage:
 *   bun scripts/audit/wikios-corpus-diff.ts --old=<checkout of the old code> --corpus=<dir>
 *   Options: --only=<substring of a function name> --shard=<i>/<n> --revisions=<every nth revision, default 4, 0 for none>
 *            --json=<path> (every difference, in full)
 *
 * Nothing is written to a database, and none is reached: DATABASE_URL points at nothing.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { TARGETS, type Target } from "./wikios-regex-fuzz-targets";

process.env.DATABASE_URL = "postgresql://nobody:nothing@127.0.0.1:1/none";
process.env.SKIP_ENV_VALIDATION = "1";

interface Page {
  label: string;
  text: string;
}

/** What a call answered: its value, or the message it threw. */
type Outcome = { value: unknown } | { threw: string };

type Call = (input: string) => unknown;

const option = (name: string): string | null =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;

function readLines(dir: string, file: string): Array<Record<string, unknown>> {
  const path = join(dir, file);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function outcomeOf(call: Call, input: string): Promise<Outcome> {
  try {
    return { value: await call(input) };
  } catch (error) {
    return { threw: String(error instanceof Error ? error.message : error).slice(0, 200) };
  }
}

/** A short description of where two answers part ways. */
function describeDifference(a: Outcome, b: Outcome): string {
  if ("threw" in a || "threw" in b)
    return `old ${JSON.stringify(a).slice(0, 100)} | new ${JSON.stringify(b).slice(0, 100)}`;
  const left = typeof a.value === "string" ? a.value : (JSON.stringify(a.value) ?? "undefined");
  const right = typeof b.value === "string" ? b.value : (JSON.stringify(b.value) ?? "undefined");
  let at = 0;
  while (at < left.length && at < right.length && left[at] === right[at]) at++;
  const show = (text: string) => JSON.stringify(text.slice(Math.max(0, at - 30), at + 50));
  return `at ${at} of ${left.length}/${right.length}: old ${show(left)} | new ${show(right)}`;
}

// ---- the two functions that have no old home: the old code, verbatim ------------------------------------------

/** `leadParagraph` as main-page-service.ts had it (a private function; it is now main-page/lead-paragraph.ts). */
function oldLeadParagraph(html: string): string {
  const lead = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? []).find(
    (p) => p.length > 25 && !/infobox|mw-empty-elt/i.test(p)
  );
  return (lead ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main(): Promise<number> {
  const oldDir = resolve(option("old") ?? "");
  const corpusDir = resolve(option("corpus") ?? "");
  if (!option("old") || !option("corpus") || !existsSync(oldDir) || !existsSync(corpusDir)) {
    console.error(
      "usage: bun scripts/audit/wikios-corpus-diff.ts --old=<old checkout> --corpus=<dir>"
    );
    return 2;
  }
  const only = option("only");
  const [shardIndex, shardCount] = (option("shard") ?? "0/1").split("/").map(Number) as [
    number,
    number,
  ];
  const everyRevision = Number(option("revisions") ?? 4);

  // The same drivers run in both trees: the target list is copied into the old checkout.
  const oldTargetsPath = join(oldDir, "scripts/audit/wikios-regex-fuzz-targets.ts");
  copyFileSync(join(import.meta.dirname, "wikios-regex-fuzz-targets.ts"), oldTargetsPath);
  const oldTargets = (await import(oldTargetsPath)).TARGETS as readonly Target[];

  // ---- the corpus ------------------------------------------------------------------------------------------------
  const wikitext: Page[] = [
    ...readLines(corpusDir, "articles-wikitext.jsonl").map((row) => ({
      label: `article:${String(row.title)}`,
      text: String(row.text ?? ""),
    })),
    ...(everyRevision > 0
      ? readLines(corpusDir, "revisions-wikitext.jsonl")
          .filter((_row, index) => index % everyRevision === 0)
          .map((row) => ({ label: `revision:${String(row.id)}`, text: String(row.text ?? "") }))
      : []),
  ].filter((page) => page.text.trim() !== "");

  const compile = (await oldTargets
    .find((target) => target.name === "transformers/wikitext-parser#parseWikitextToHtml")!
    .load()) as Call;
  const html: Page[] = [
    ...readLines(corpusDir, "articles-contenthtml.jsonl").map((row) => ({
      label: `contentHtml:${String(row.title)}`,
      text: String(row.text ?? ""),
    })),
    ...readLines(corpusDir, "articles-renderedview.jsonl").flatMap((row) =>
      (["body", "infobox", "notices"] as const)
        .filter((part) => typeof row[part] === "string" && row[part] !== "")
        .map((part) => ({ label: `${part}Html:${String(row.title)}`, text: String(row[part]) }))
    ),
  ];
  for (const page of wikitext.filter((entry) => entry.label.startsWith("article:"))) {
    html.push({ label: `compiled:${page.label}`, text: String(await compile(page.text)) });
  }

  // A dump of the first pages, written by the (unchanged) export writer: the reader reads real XML too.
  const xml: Page[] = [];
  {
    const { createExportWriter } = await import(
      join(oldDir, "src/lib/wiki-os/xml/export-writer.ts")
    );
    const pages = wikitext.filter((entry) => entry.label.startsWith("article:"));
    for (let from = 0; from < pages.length; from += 25) {
      let dump = "";
      const writer = createExportWriter((chunk: string) => void (dump += chunk));
      await writer.start();
      for (const [offset, page] of pages.slice(from, from + 25).entries()) {
        await writer.page({
          title: page.label.slice("article:".length),
          ns: 0,
          pageId: from + offset + 1,
          redirectTitle: null,
          revisions: [
            {
              id: from + offset + 1,
              parentId: null,
              timestamp: "2026-01-01T00:00:00Z",
              contributor: { username: "Someone", id: 1 },
              comment: "c",
              commentDeleted: false,
              minor: false,
              model: "wikitext",
              format: "text/x-wiki",
              text: page.text,
              textDeleted: false,
              bytes: page.text.length,
              sha1: null,
            },
          ],
        });
      }
      await writer.end();
      xml.push({ label: `dump:${from}`, text: dump });
    }
  }

  console.log(
    `corpus: ${wikitext.length} wikitext pages, ${html.length} HTML pages, ${xml.length} XML dumps; ` +
      `${wikitext.reduce((sum, page) => sum + page.text.length, 0)} + ${html.reduce((sum, page) => sum + page.text.length, 0)} characters`
  );

  // ---- the functions ---------------------------------------------------------------------------------------------
  interface Pair {
    name: string;
    pages: Page[];
    old: () => Promise<Call>;
    new: () => Promise<Call>;
    note?: string;
  }
  const pairs: Pair[] = [];
  const pagesOf = (kind: Target["kind"]): Page[] =>
    kind === "html" || kind === "markup" ? html : kind === "xml" ? xml : wikitext;
  // The fuzz drivers are hostile by design; these two are given the input they would really get instead.
  const titles: Page[] = readLines(corpusDir, "articles-wikitext.jsonl").map((row) => ({
    label: `title:${String(row.title)}`,
    text: String(row.title),
  }));
  const TITLE_TARGETS = new Set([
    "core/title#canonicalizeTitle",
    "core/title#sameTitle",
    "core/title#decodeTitleParam",
    "transformers/url-compat#titleToWikiOSPath",
    "transformers/url-compat#titleToWikiOSRoute",
    "api-compat/modules/list-common#canonicalTitle",
    "namespace-policy#checkEditPolicy",
    "xml/export-request#parseTitleList",
  ]);
  const NATURAL = new Set(["transformers/slim-html#slimArticleHtml"]); // its driver pads the text past the size ceiling
  for (const target of TARGETS) {
    const old = oldTargets.find((candidate) => candidate.name === target.name);
    const driver = {
      old: old?.load as () => Promise<Call>,
      new: target.load as () => Promise<Call>,
    };
    if (!old || NATURAL.has(target.name)) continue;
    // A text as long as a page is no title: the title functions get both the page text and its title.
    pairs.push({
      name: target.name,
      pages: TITLE_TARGETS.has(target.name) ? titles : pagesOf(target.kind),
      ...driver,
    });
    if (TITLE_TARGETS.has(target.name)) {
      pairs.push({
        name: `${target.name} (on page text: a hostile title)`,
        pages: pagesOf(target.kind),
        ...driver,
      });
    }
  }
  pairs.push({
    name: "transformers/slim-html#slimArticleHtml (as it is called)",
    pages: html,
    old: async () =>
      (await import(join(oldDir, "src/lib/wiki-os/transformers/slim-html.ts"))).slimArticleHtml,
    new: async () => (await import("../../src/lib/wiki-os/transformers/slim-html")).slimArticleHtml,
  });
  pairs.push(
    {
      name: "main-page/lead-paragraph#leadParagraph (against the code it was extracted from)",
      pages: html,
      old: async () => oldLeadParagraph,
      new: async () =>
        (await import("../../src/lib/wiki-os/main-page/lead-paragraph")).leadParagraph,
    },
    {
      name: "xml/import-reader#readExport (every event of a real dump)",
      pages: xml,
      old: async () => {
        const { readExport } = await import(join(oldDir, "src/lib/wiki-os/xml/import-reader.ts"));
        return async (text: string) => {
          const events: unknown[] = [];
          for await (const event of readExport(
            (async function* () {
              yield new TextEncoder().encode(text);
            })()
          )) {
            events.push(event);
          }
          return events;
        };
      },
      new: async () => {
        const { readExport } = await import("../../src/lib/wiki-os/xml/import-reader");
        return async (text: string) => {
          const events: unknown[] = [];
          for await (const event of readExport(
            (async function* () {
              yield new TextEncoder().encode(text);
            })()
          )) {
            events.push(event);
          }
          return events;
        };
      },
    }
  );

  const selected = pairs.filter(
    (pair, index) => index % shardCount === shardIndex && (!only || pair.name.includes(only))
  );
  const report: Array<{
    name: string;
    compared: number;
    differing: number;
    differences: Array<{ page: string; detail: string }>;
  }> = [];
  console.log(`\n${"function".padEnd(96)}pages  differing`);
  for (const pair of selected) {
    let oldCall: Call;
    let newCall: Call;
    try {
      oldCall = await pair.old();
      newCall = await pair.new();
    } catch (error) {
      const missing = String(error).includes("Cannot find package '~'");
      console.log(
        `${pair.name.padEnd(96)}${missing ? "no old implementation (a new module): compared below" : `could not load: ${String(error).slice(0, 100)}`}`
      );
      continue;
    }
    const differences: Array<{ page: string; detail: string }> = [];
    for (const page of pair.pages) {
      const before = await outcomeOf(oldCall, page.text);
      const after = await outcomeOf(newCall, page.text);
      if (!isDeepStrictEqual(before, after)) {
        differences.push({ page: page.label, detail: describeDifference(before, after) });
      }
    }
    report.push({
      name: pair.name,
      compared: pair.pages.length,
      differing: differences.length,
      differences,
    });
    console.log(
      `${pair.name.padEnd(96)}${String(pair.pages.length).padEnd(7)}${differences.length}` +
        (differences.length > 0 ? `   e.g. ${differences[0]!.page}: ${differences[0]!.detail}` : "")
    );
  }

  const total = report.reduce((sum, entry) => sum + entry.differing, 0);
  console.log(
    `\n${report.length} functions, ${report.reduce((sum, entry) => sum + entry.compared, 0)} comparisons, ${total} differing.`
  );
  const json = option("json");
  if (json) writeFileSync(json, JSON.stringify(report, null, 1));
  return total === 0 ? 0 : 1;
}

process.exit(await main());
