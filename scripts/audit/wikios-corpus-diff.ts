/**
 * scripts/audit/wikios-corpus-diff.ts — the text functions of src/lib/wiki-os, old against new, on real pages.
 *
 * The regex-DoS sweep (plan F15) rewrote scanners and regular-expression passes, and every rewrite is held
 * against the code it replaced on random token soups (tests/lib/wiki-os/regex-dos-*.test.ts). This holds
 * them against real pages too: the same function of an OLD checkout and of this tree is run on every page of
 * a corpus and the answers are compared with `isDeepStrictEqual`. The functions are the ones the fuzz script
 * lists (wikios-regex-fuzz-targets.ts, copied into the old checkout so both run the same drivers); one more
 * that had no home in the old tree is compared against a verbatim copy of the old code below.
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

type ExportWriterModule = typeof import("../../src/lib/wiki-os/xml/export-writer");
type ImportReaderModule = typeof import("../../src/lib/wiki-os/xml/import-reader");
type SlimModule = typeof import("../../src/lib/wiki-os/transformers/slim-html");
type ChipsModule = typeof import("../../src/lib/wiki-os/templates/chip-markers");

/** A page of a corpus: where it came from and its text. */
interface Page {
  label: string;
  text: string;
}

/** One line of a corpus file. */
type Row = Record<string, string | number | null>;

/** The call a target's driver makes on a text. */
type Call = Awaited<ReturnType<Target["load"]>>;

/** What a call answered: its value, or the message it threw. */
type Outcome = { value: Awaited<ReturnType<Call>> } | { threw: string };

/** One function of the old tree and of this one, and the pages to run them on. */
interface Pair {
  name: string;
  pages: Page[];
  old: () => Promise<Call>;
  new: () => Promise<Call>;
}

interface Entry {
  name: string;
  compared: number;
  differing: number;
  differences: Array<{ page: string; detail: string }>;
}

/** Every page of the corpus, by what a function reads. */
interface Corpus {
  wikitext: Page[];
  html: Page[];
  xml: Page[];
  titles: Page[];
}

const option = (name: string): string | null =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;

function readLines(dir: string, file: string): Row[] {
  const path = join(dir, file);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Row);
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
  if ("threw" in a || "threw" in b) {
    return `old ${JSON.stringify(a).slice(0, 100)} | new ${JSON.stringify(b).slice(0, 100)}`;
  }
  const left = typeof a.value === "string" ? a.value : (JSON.stringify(a.value) ?? "undefined");
  const right = typeof b.value === "string" ? b.value : (JSON.stringify(b.value) ?? "undefined");
  let at = 0;
  while (at < left.length && at < right.length && left[at] === right[at]) at++;
  const show = (text: string) => JSON.stringify(text.slice(Math.max(0, at - 30), at + 50));
  return `at ${at} of ${left.length}/${right.length}: old ${show(left)} | new ${show(right)}`;
}

// ---- the one function that has no old home: the old code, verbatim -------------------------------------------

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

// ---- the corpus ------------------------------------------------------------------------------------------------

function wikitextPages(dir: string, everyRevision: number): Page[] {
  const articles = readLines(dir, "articles-wikitext.jsonl").map((row) => ({
    label: `article:${String(row.title)}`,
    text: String(row.text ?? ""),
  }));
  const revisions =
    everyRevision > 0
      ? readLines(dir, "revisions-wikitext.jsonl")
          .filter((_row, index) => index % everyRevision === 0)
          .map((row) => ({ label: `revision:${String(row.id)}`, text: String(row.text ?? "") }))
      : [];
  return [...articles, ...revisions].filter((page) => page.text.trim() !== "");
}

/** The HTML pages: the stored ones, and the old compiler's HTML of every article. */
async function htmlPages(dir: string, wikitext: Page[], compile: Call): Promise<Page[]> {
  const stored = readLines(dir, "articles-contenthtml.jsonl").map((row) => ({
    label: `contentHtml:${String(row.title)}`,
    text: String(row.text ?? ""),
  }));
  const rendered = readLines(dir, "articles-renderedview.jsonl").flatMap((row) =>
    (["body", "infobox", "notices"] as const)
      .filter((part) => typeof row[part] === "string" && row[part] !== "")
      .map((part) => ({ label: `${part}Html:${String(row.title)}`, text: String(row[part]) }))
  );
  const compiled: Page[] = [];
  for (const page of wikitext.filter((entry) => entry.label.startsWith("article:"))) {
    compiled.push({ label: `compiled:${page.label}`, text: String(await compile(page.text)) });
  }
  return [...stored, ...rendered, ...compiled];
}

/** Dumps of the articles, 25 a dump, written by the (unchanged) export writer: the reader reads real XML too. */
async function xmlDumps(oldDir: string, wikitext: Page[]): Promise<Page[]> {
  const { createExportWriter } = (await import(
    join(oldDir, "src/lib/wiki-os/xml/export-writer.ts")
  )) as ExportWriterModule;
  const pages = wikitext.filter((entry) => entry.label.startsWith("article:"));
  const dumps: Page[] = [];
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
    dumps.push({ label: `dump:${from}`, text: dump });
  }
  return dumps;
}

async function loadCorpus(
  dir: string,
  oldDir: string,
  everyRevision: number,
  compile: Call
): Promise<Corpus> {
  const wikitext = wikitextPages(dir, everyRevision);
  const titles = readLines(dir, "articles-wikitext.jsonl").map((row) => ({
    label: `title:${String(row.title)}`,
    text: String(row.title),
  }));
  return {
    wikitext,
    html: await htmlPages(dir, wikitext, compile),
    xml: await xmlDumps(oldDir, wikitext),
    titles,
  };
}

// ---- the functions ---------------------------------------------------------------------------------------------

/** A text as long as a page is no title: these get both the page text (a hostile title) and the title. */
const TITLE_TARGETS: ReadonlySet<string> = new Set([
  "core/title#canonicalizeTitle",
  "core/title#sameTitle",
  "core/title#decodeTitleParam",
  "transformers/url-compat#titleToWikiOSPath",
  "transformers/url-compat#titleToWikiOSRoute",
  "api-compat/modules/list-common#canonicalTitle",
  "namespace-policy#checkEditPolicy",
  "xml/export-request#parseTitleList",
]);

/** The fuzz drivers whose input is hostile by design and are given the input they would really get instead. */
const NATURAL: ReadonlySet<string> = new Set([
  "transformers/slim-html#slimArticleHtml",
  "templates/chip-markers#markTemplateChips",
]); // their drivers pad the text past the size ceiling

function pagesOf(corpus: Corpus, kind: Target["kind"]): Page[] {
  if (kind === "html" || kind === "markup") return corpus.html;
  if (kind === "svg" || kind === "css") return []; // no real SVG or stylesheet in the corpus
  return kind === "xml" ? corpus.xml : corpus.wikitext;
}

/** The pairs the fuzz script's drivers make: every target the old tree has too. */
function targetPairs(corpus: Corpus, oldTargets: readonly Target[]): Pair[] {
  const pairs: Pair[] = [];
  for (const target of TARGETS) {
    const old = oldTargets.find((candidate) => candidate.name === target.name);
    if (!old || NATURAL.has(target.name)) continue;
    const driver = { old: old.load, new: target.load };
    const isTitle = TITLE_TARGETS.has(target.name);
    pairs.push({
      name: target.name,
      pages: isTitle ? corpus.titles : pagesOf(corpus, target.kind),
      ...driver,
    });
    if (isTitle) {
      pairs.push({
        name: `${target.name} (on page text: a hostile title)`,
        pages: pagesOf(corpus, target.kind),
        ...driver,
      });
    }
  }
  return pairs;
}

/** `readExport` as a call that answers every event of a dump. */
function eventsOf(readExport: ImportReaderModule["readExport"]): Call {
  return async (text) => {
    const events: object[] = [];
    const chunks = (async function* () {
      yield new TextEncoder().encode(text);
    })();
    for await (const event of readExport(chunks)) events.push(event);
    return events;
  };
}

/** The pairs the fuzz drivers do not make: a function as it is really called, or one that was extracted. */
function extraPairs(corpus: Corpus, oldDir: string): Pair[] {
  return [
    {
      name: "transformers/slim-html#slimArticleHtml (as it is called)",
      pages: corpus.html,
      old: async () =>
        ((await import(join(oldDir, "src/lib/wiki-os/transformers/slim-html.ts"))) as SlimModule)
          .slimArticleHtml,
      new: async () =>
        (await import("../../src/lib/wiki-os/transformers/slim-html")).slimArticleHtml,
    },
    {
      name: "templates/chip-markers#markTemplateChips (as it is called)",
      pages: corpus.html,
      old: async () =>
        ((await import(join(oldDir, "src/lib/wiki-os/templates/chip-markers.ts"))) as ChipsModule)
          .markTemplateChips,
      new: async () =>
        (await import("../../src/lib/wiki-os/templates/chip-markers")).markTemplateChips,
    },
    {
      name: "main-page/lead-paragraph#leadParagraph (against the code it was extracted from)",
      pages: corpus.html,
      old: async () => oldLeadParagraph,
      new: async () =>
        (await import("../../src/lib/wiki-os/main-page/lead-paragraph")).leadParagraph,
    },
    {
      name: "xml/import-reader#readExport (every event of a real dump)",
      pages: corpus.xml,
      old: async () =>
        eventsOf(
          (
            (await import(
              join(oldDir, "src/lib/wiki-os/xml/import-reader.ts")
            )) as ImportReaderModule
          ).readExport
        ),
      new: async () =>
        eventsOf((await import("../../src/lib/wiki-os/xml/import-reader")).readExport),
    },
  ];
}

/** The old and the new function on every page of `pair`; null when one of them cannot be loaded (said on the way). */
async function compare(pair: Pair): Promise<Entry | null> {
  let oldCall: Call;
  let newCall: Call;
  try {
    oldCall = await pair.old();
    newCall = await pair.new();
  } catch (error) {
    const missing = String(error).includes("Cannot find package '~'");
    const said = missing
      ? "no old implementation (a new module): compared below"
      : `could not load: ${String(error).slice(0, 100)}`;
    console.log(`${pair.name.padEnd(96)}${said}`);
    return null;
  }
  const differences: Entry["differences"] = [];
  for (const page of pair.pages) {
    const before = await outcomeOf(oldCall, page.text);
    const after = await outcomeOf(newCall, page.text);
    if (!isDeepStrictEqual(before, after)) {
      differences.push({ page: page.label, detail: describeDifference(before, after) });
    }
  }
  const entry = {
    name: pair.name,
    compared: pair.pages.length,
    differing: differences.length,
    differences,
  };
  const first = differences[0];
  console.log(
    `${pair.name.padEnd(96)}${String(entry.compared).padEnd(7)}${entry.differing}` +
      (first ? `   e.g. ${first.page}: ${first.detail}` : "")
  );
  return entry;
}

function parseShard(): { index: number; count: number } {
  const [index = 0, count = 1] = (option("shard") ?? "0/1").split("/").map(Number);
  return { index, count };
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

  // The same drivers run in both trees: the target list is copied into the old checkout.
  const oldTargetsPath = join(oldDir, "scripts/audit/wikios-regex-fuzz-targets.ts");
  copyFileSync(join(import.meta.dirname, "wikios-regex-fuzz-targets.ts"), oldTargetsPath);
  const oldTargets = ((await import(oldTargetsPath)) as { TARGETS: readonly Target[] }).TARGETS;
  const compile = await oldTargets
    .find((target) => target.name === "transformers/wikitext-parser#parseWikitextToHtml")!
    .load();

  const corpus = await loadCorpus(corpusDir, oldDir, Number(option("revisions") ?? 4), compile);
  const characters = (pages: Page[]) => pages.reduce((sum, page) => sum + page.text.length, 0);
  console.log(
    `corpus: ${corpus.wikitext.length} wikitext pages, ${corpus.html.length} HTML pages, ${corpus.xml.length} XML dumps; ` +
      `${characters(corpus.wikitext)} + ${characters(corpus.html)} characters`
  );

  const only = option("only");
  const shard = parseShard();
  const selected = [...targetPairs(corpus, oldTargets), ...extraPairs(corpus, oldDir)].filter(
    (pair, index) => index % shard.count === shard.index && (!only || pair.name.includes(only))
  );
  console.log(`\n${"function".padEnd(96)}pages  differing`);
  const report: Entry[] = [];
  for (const pair of selected) {
    const entry = await compare(pair);
    if (entry) report.push(entry);
  }

  const total = report.reduce((sum, entry) => sum + entry.differing, 0);
  const comparisons = report.reduce((sum, entry) => sum + entry.compared, 0);
  console.log(`\n${report.length} functions, ${comparisons} comparisons, ${total} differing.`);
  const json = option("json");
  if (json) writeFileSync(json, JSON.stringify(report, null, 1));
  return total === 0 ? 0 : 1;
}

process.exit(await main());
