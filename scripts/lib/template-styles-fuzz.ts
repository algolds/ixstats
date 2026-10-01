/**
 * Seeded generators of hostile TemplateStyles sheets, and the runner that feeds them to `scopeTemplateStyles` and
 * judges the result with the oracle (plan 415 re-review). Used by the Jest gate (a bounded run with fixed seeds,
 * `src/tests/security/scope-template-styles-oracle.test.ts`) and by the deep manual run
 * (`scripts/audit/fuzz-template-styles.ts`, hundreds of thousands of cases).
 *
 * Every generator is deterministic for its seed. Each sheet it makes is run through the scoper with the wiki's
 * origin; a non-empty output must have no violation (`violations()` of the oracle) and must be a fixed point:
 * scoping it again gives the same text (stored renders are sanitized once more on every read path).
 *
 * The generators:
 *  - `general`: rules built from selector, property and value pieces with fragments of every hostile kind spliced in;
 *  - `soup`: random runs of url( / quote / paren / comment / brace pieces in and around a url();
 *  - `comment-url`: `soup` with the comment-inside-an-unquoted-url shapes (`url(a/*)*` + `/`) over-represented;
 *  - `host`: url() arguments built from allowed and foreign hosts, odd separators, `)`, escapes and quotes;
 *  - `sibling`: selectors that start with the root (or an escaped spelling of it) and then ask for siblings,
 *    ancestors or combinators in every gap spelling.
 */
import { scopeTemplateStyles } from "../../src/lib/utils/scope-template-styles";
import { OWN_ORIGIN, violations } from "./template-styles-oracle";

type Rng = () => number;

/** A linear congruential generator: small, and the same everywhere. */
function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(rnd: Rng, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length)] as T;
}

const FRAGMENTS = [
  ".a", ".b", "body", "html", "*", ":root", "{", "}", "(", ")", "[", "]", ";", ":", ",", " ", "\n",
  '"', "'", "\\", '\\"', "\\'", "\\)", "\\(", "\\}", "\\{", "/*", "*/", "url(", "URL(", "\\75 rl(", "u\\72l(", "url( ", 'url("', "url('",
  "x", "y", "color", "red", "background", "display", "none", "@media", "@media screen", "@import", "@font-face", "@keyframes",
  ">", "+", "~", ".mw-parser-output", ".mw-parser-output", " ~ *", ":is(", ":not(", ":has(", "!important", "--v", "-->", "<!--",
  'url(x"', "url(x'", "url(x(", "url(x y", '\\75 rl(x"', "image-set(", "expression(", "behavior:", "-moz-binding:", "javascript:",
  "https://e/x", "//e/x", "https://ixwiki.com/a", "https://ixwiki.com.evil/x", "https://ixwiki.com@e/x", "HTTPS://e/x", "https:/e/x",
  "\\\\e/x", "%2F%2Fe/x", "xn--e.example", "&", ":where(", ":root ~ x", ":scope", "\n", "\t", "data:x", "\t", "\f", "\r", "\u0000",
  "\\75 ", "\\", "@\\6d edia", "attr(", "attr(x url)",
];
const SELECTORS = [
  ".a", ".b", "p", "a[href]", ".a:is(.b)", ".a>.b", "x:not(.y)", ".mw-parser-output", ".mw-parser-output .c", ".mw-parser-output ~ x",
];
const PROPERTIES = ["color", "background", "display", "content", "width", "background-image", "font-family"];
const VALUES = [
  "red", "none", "url(x)", 'url("x")', "url('x')", "url( x )", '"s"', "'s'", "1px solid red", "url(a.png) no-repeat",
  "calc(1px + 2px)", "attr(x)",
];

function general(rnd: Rng): string {
  const junk = (): string => {
    let text = "";
    for (let i = Math.floor(rnd() * 4); i > 0; i--) text += pick(rnd, FRAGMENTS);
    return text;
  };
  const part = (list: readonly string[]): string =>
    (rnd() < 0.35 ? junk() : "") + pick(rnd, list) + (rnd() < 0.35 ? junk() : "");
  const rule = (): string => {
    let body = "";
    for (let i = 1 + Math.floor(rnd() * 3); i > 0; i--) body += `${part(PROPERTIES)}:${part(VALUES)}${rnd() < 0.8 ? ";" : ""}`;
    if (rnd() < 0.1) body += junk();
    return `${part(SELECTORS)}{${body}}`;
  };
  let sheet = "";
  for (let i = 1 + Math.floor(rnd() * 4); i > 0; i--) {
    sheet += rnd() < 0.12 ? `@media screen{${rule()}}` : rule();
    if (rnd() < 0.15) sheet += junk();
  }
  return sheet;
}

const SOUP = [
  "url(", "URL(", "\\75 rl(", "u\\72l(", "url(", "a", "x", "/*", "*/", "/**/", ")", ")", "(", '"', "'", " ", " ", ";", "}", "}", "{",
  "body", ".a", ".b", ":", "display:none", "color:red", "\\", "\n", "\t", "https://e/x", "//e/x", "\\29 ", "\\22 ", "[", "]", ",",
  "@media screen", "@font-face", "!", "-->", "&",
];
const COMMENT_SOUP = ["url(a/*)*/", "url(/*)*/a", "url(a/*(*/", ...SOUP];

function soupSheet(rnd: Rng, pieces: readonly string[]): string {
  let body = "";
  for (let i = 4 + Math.floor(rnd() * 22); i > 0; i--) body += pick(rnd, pieces);
  switch (Math.floor(rnd() * 4)) {
    case 0:
      return `.a{background:${body}}.c{color:red}`;
    case 1:
      return `.a{background:url(${body}}.c{color:red}.d{background:url(${pick(rnd, pieces)}${body}}`;
    case 2:
      return `${body}{color:red}body{display:none}`;
    default:
      return `.a{background:${body}}body{display:none}.b{background:${body}}`;
  }
}

const HOSTS = [
  "https://ixwiki.com", "HTTPS://IXWIKI.COM", "https://ixwiki.com:443", "https://evil.example", "//evil.example", "https:/evil.example",
  "https:\\\\evil.example", "\\\\evil.example", "/", "a", "../a", "https:", "http://ixwiki.com", "https://ixwiki.com.evil.example",
  "https://ixwiki.com@evil.example",
];
const MIDDLES = [
  ")", "\\29 ", "\\29", ")@", "\\29@", ")x.evil.example", "\\)", "\\\\)", '"', "'", "\\22 ", "\t", "\n", " ", "%2F%2F", "/", "@", ".", "(",
  "/*)*/", "/*", "*/", "\\2f\\2f",
];
const TAILS = ["/a.png", "", "?x=1", "#f", "/x)y"];
const URL_NAMES = ["url(", "URL(", "\\75 rl(", "u\\72l(", "url( ", "url(\n", "-url(", "xurl(", "url ("];
const URL_PROPERTIES = ["background", "content", "cursor", "list-style-image", "--x", "border-image-source"];

function hostSheet(rnd: Rng): string {
  const token = (): string => {
    const quote = pick(rnd, ["", "", '"', "'"]);
    const argument =
      pick(rnd, HOSTS) +
      (rnd() < 0.7 ? pick(rnd, MIDDLES) : "") +
      (rnd() < 0.4 ? pick(rnd, MIDDLES) : "") +
      pick(rnd, HOSTS).replace(/^https?:/, "") +
      pick(rnd, TAILS);
    return `${pick(rnd, URL_NAMES)}${quote}${argument}${quote}${rnd() < 0.85 ? ")" : ""}`;
  };
  let declarations = "";
  for (let i = 1 + Math.floor(rnd() * 3); i > 0; i--) {
    declarations += `${pick(rnd, URL_PROPERTIES)}:${token()}${rnd() < 0.3 ? ` ${token()}` : ""};`;
  }
  return `.a{${declarations}color:red}${rnd() < 0.3 ? `.b{background:${token()}}` : ""}`;
}

const ROOTS = [".mw-parser-output", ".mw-parser-output", ".mw-parser-\\6f utput", ".\\6d w-parser-output", ".mw\\-parser-output", ".mw-parser-output\\ "];
const SUFFIXES = ["", "", ".x", "[a]", ":hover", ":not(.y)", ":is(.z, .w)", "#id", "::before", ":first-child", "\\.x", ".mw-parser-output", "[a='~']"];
const GAPS = ["", " ", "/**/", " /* c */ ", "\n", "\t", "\\ "];
const COMBINATORS = ["+", "~", ">", " ", "||", ">>>", "/deep/"];
const TARGETS = ["p", ".c", "*", "x:not(.y)", "&", ":is(a,b)", ":root", "body", ".mw-parser-output"];
const LEADERS = ["", "", "", "~ ", "+ ", "> ", "/**/+ ", ":is(", ":where(", ":not(", ":has(", ":has(+ ", "\\"];

function siblingSheet(rnd: Rng): string {
  const selector = (): string => {
    let text = pick(rnd, LEADERS) + pick(rnd, ROOTS) + pick(rnd, SUFFIXES);
    for (let i = Math.floor(rnd() * 3); i > 0; i--) {
      text += `${pick(rnd, GAPS)}${pick(rnd, COMBINATORS)}${pick(rnd, GAPS)}${pick(rnd, TARGETS)}${pick(rnd, SUFFIXES)}`;
    }
    return rnd() < 0.15 ? `${text})` : text;
  };
  const list: string[] = [];
  for (let i = 1 + Math.floor(rnd() * 3); i > 0; i--) list.push(selector());
  const rule = `${list.join(rnd() < 0.9 ? "," : " , ")}{color:red}`;
  return rnd() < 0.2 ? `@media screen{${rule}}.d{color:blue}` : `${rule}.d{color:blue}`;
}

export const GENERATORS: Readonly<Record<string, { seed: number; make: (rnd: Rng) => string }>> = {
  general: { seed: 12345, make: general },
  soup: { seed: 4242, make: (rnd) => soupSheet(rnd, SOUP) },
  "comment-url": { seed: 777, make: (rnd) => soupSheet(rnd, COMMENT_SOUP) },
  host: { seed: 31337, make: hostSheet },
  sibling: { seed: 2024, make: siblingSheet },
};

export interface FuzzReport {
  generator: string;
  ran: number;
  /** Sheets the scoper kept something of (only these are judged). */
  nonEmpty: number;
  violationCount: number;
  nonIdempotentCount: number;
  /** The first few failures, with their input and output. */
  samples: string[];
}

const MAX_SAMPLES = 6;

/** Runs `iterations` sheets of `generator` (from `seed`, or the generator's own) through the scoper and the oracle. */
export function runGenerator(name: string, iterations: number, seed?: number): FuzzReport {
  const generator = GENERATORS[name];
  if (!generator) throw new Error(`unknown generator "${name}"`);
  const rnd = makeRng(seed ?? generator.seed);
  const report: FuzzReport = { generator: name, ran: 0, nonEmpty: 0, violationCount: 0, nonIdempotentCount: 0, samples: [] };
  const note = (text: string): void => {
    if (report.samples.length < MAX_SAMPLES) report.samples.push(text);
  };
  for (let i = 0; i < iterations; i++) {
    const css = generator.make(rnd);
    const out = scopeTemplateStyles(css, OWN_ORIGIN);
    report.ran++;
    if (!out) continue;
    report.nonEmpty++;
    const found = violations(out);
    if (found.length > 0) {
      report.violationCount++;
      note(`VIOLATION ${JSON.stringify(found.slice(0, 3))}\n  in : ${JSON.stringify(css)}\n  out: ${JSON.stringify(out)}`);
    }
    const again = scopeTemplateStyles(out, OWN_ORIGIN);
    if (again !== out) {
      report.nonIdempotentCount++;
      note(`NOT IDEMPOTENT\n  in : ${JSON.stringify(css)}\n  1  : ${JSON.stringify(out)}\n  2  : ${JSON.stringify(again)}`);
    }
  }
  return report;
}
