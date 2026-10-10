/**
 * Hex → design-token codemod (Facet §10 "Zero-Hex"). Idempotent; run with:
 *   bun scripts/codemods/hex-to-tokens.ts [--dry] [--verbose] [--report <out.json>] [paths...]
 *
 * `paths` default to `src`; each may be a directory or a single .ts/.tsx/.css file.
 * `--verbose` also lists every target site that was left alone; `--report` writes the full
 * classified inventory (every hex in the scanned paths) as JSON; `--no-palette` skips tier 2.
 *
 * Rewrites only two kinds of site:
 *   (a) Tailwind arbitrary colour classes       bg-[#5865F2]/10      → bg-discord/10
 *   (b) JSX style={{…}} colour props            color: "#ffffff"     → color: "var(--color-white)"
 *       plain CSS colour declarations           color: #ef4444;      → color: var(--color-error);
 *
 * A hex is mapped (mapHex) only when, for the site's role (surface / text / border / paint):
 *   1. TOKENS — it equals a token's value under the site's theme scope. Unscoped sites compare
 *      against the DEFAULT (dark) theme, so the default theme renders identically and light mode
 *      starts following the token; `.light` / `[data-theme=light]` CSS compares light values;
 *      `dark:` classes and `.dark` CSS compare dark values. No `dark:` variants are ever added.
 *      So white text on a coloured button stays white (`#fff` → white, never → foreground).
 *   2. PALETTE_NEUTRALS — a Tailwind v3 neutral hex; v4 re-expressed the neutral families in
 *      OKLCH and renders each within 4/255 per channel of the v3 value (imperceptible). The
 *      chromatic v3 hexes shifted 11–36/255 in v4, so they are NOT mapped to palette names.
 *
 * No near-duplicate tier: the 2026-09 inventory found no near-miss of a token (≤8/255) recurring
 * in a rewritable site — the recurring ones (#ffffff≈light bg ×11, #6b7280≈light muted-fg ×4)
 * sit in JS literals and gradients, which this codemod reports but never rewrites.
 *
 * Everything else is reported, never changed: comments, `var(--x, #fallback)`, custom-property
 * definitions (the token sources themselves), alpha hexes (#rgba / #rrggbbaa), gradients,
 * shadows and other functions, JS literals outside style={{}}, and DATA colours (DATA_PATHS,
 * DATA_CONTEXT and ART_SELECTOR: charts, map paint, flags/heraldry, cards/rarity, sports,
 * SVG/canvas art, OG images, colour pickers, Facet material/texture palettes, …).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export type Role = "surface" | "text" | "border" | "paint";
export type Scope = "unscoped" | "dark" | "light";
export type Target = "class" | "css";
export type SiteKind =
  | "class"
  | "class-complex"
  | "style"
  | "style-complex"
  | "css"
  | "css-effect"
  | "js-literal"
  | "data"
  | "fallback"
  | "token-def"
  | "comment";

export interface TokenMatch {
  /** Tailwind colour name for classes (bg-<utility>); null → CSS-variable-only token. */
  utility: string | null;
  /** Custom property used in CSS / inline styles. */
  cssVar: string;
  source: "token" | "palette";
}

export interface Site {
  file: string;
  line: number;
  hex: string;
  kind: SiteKind;
  mapped: TokenMatch | null;
}

interface TokenDef extends TokenMatch {
  roles: readonly Role[];
  dark: string;
  light: string;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

const SURFACE: readonly Role[] = ["surface", "border"];
const TEXT: readonly Role[] = ["text"];
const ANY: readonly Role[] = ["surface", "text", "border", "paint"];

function themed(
  utility: string | null,
  cssVar: string,
  roles: readonly Role[],
  dark: string,
  light: string
): TokenDef {
  return { utility, cssVar, roles, dark, light, source: "token" };
}

function fixed(utility: string | null, cssVar: string, hex: string): TokenDef {
  return themed(utility, cssVar, ANY, hex, hex);
}

/** Token values from src/styles/themes.css (`:root` = dark default, `.light`) and globals.css @theme. */
export const TOKENS: readonly TokenDef[] = [
  // Theme-switching neutrals.
  themed("background", "--background", SURFACE, "#0f1114", "#f8fafc"),
  themed("card", "--card", SURFACE, "#16181d", "#ffffff"),
  themed("muted", "--muted", SURFACE, "#1e2028", "#f1f5f9"),
  themed(null, "--color-bg-accent", SURFACE, "#282a33", "#e2e8f0"),
  themed(null, "--color-bg-hover", SURFACE, "#32343e", "#e2e8f0"),
  themed("foreground", "--foreground", TEXT, "#e4e4e7", "#09090b"),
  themed("text-secondary", "--color-text-secondary", TEXT, "#d4d4d8", "#52525b"),
  themed("muted-foreground", "--muted-foreground", TEXT, "#a1a1aa", "#71717a"),
  // Theme-invariant semantic accents (null utility → CSS / inline style only).
  fixed("destructive", "--color-error", "#ef4444"),
  fixed(null, "--color-error-light", "#f87171"),
  fixed(null, "--color-error-dark", "#dc2626"),
  fixed("success", "--color-success", "#10b981"),
  fixed(null, "--color-success-light", "#34d399"),
  fixed(null, "--color-success-dark", "#059669"),
  fixed("info", "--color-info", "#3b82f6"),
  fixed(null, "--color-info-light", "#60a5fa"),
  fixed(null, "--color-info-dark", "#2563eb"),
  fixed(null, "--color-warning", "#f59e0b"),
  fixed("brand-primary", "--color-brand-primary", "#6366f1"),
  fixed("brand-secondary", "--color-brand-secondary", "#818cf8"),
  fixed(null, "--color-brand-dark", "#4f46e5"),
  fixed(null, "--color-brand-darker", "#4338ca"),
  fixed("discord", "--color-discord", "#5865f2"),
  fixed("discord-hover", "--color-discord-hover", "#4752c4"),
  fixed("wiki", "--color-wiki", "#1d4e89"),
  fixed("wiki-hover", "--color-wiki-hover", "#184275"),
  fixed("map-ocean", "--color-map-ocean", "#0a1628"),
  fixed("white", "--color-white", "#ffffff"),
  fixed("black", "--color-black", "#000000"),
  // MyCountry gold ramp (globals.css @theme --color-gold-*; gold-500 duplicates gold-400).
  fixed("gold-50", "--color-gold-50", "#fffbeb"),
  fixed("gold-100", "--color-gold-100", "#fef3c7"),
  fixed("gold-200", "--color-gold-200", "#fde68a"),
  fixed("gold-300", "--color-gold-300", "#fcd34d"),
  fixed("gold-400", "--color-gold-400", "#fbbf24"),
  fixed("gold-600", "--color-gold-600", "#d97706"),
  fixed("gold-700", "--color-gold-700", "#b45309"),
  fixed("gold-800", "--color-gold-800", "#92400e"),
  fixed("gold-900", "--color-gold-900", "#78350f"),
  fixed("gold-950", "--color-gold-950", "#451a03"),
];

/** Tailwind v3 neutral hexes → v4 palette names (zinc wins where families share a value). */
const NEUTRAL_FAMILIES: ReadonlyArray<[string, readonly string[]]> = [
  // prettier-ignore
  ["zinc", ["fafafa", "f4f4f5", "e4e4e7", "d4d4d8", "a1a1aa", "71717a", "52525b", "3f3f46", "27272a", "18181b", "09090b"]],
  // prettier-ignore
  ["neutral", ["fafafa", "f5f5f5", "e5e5e5", "d4d4d4", "a3a3a3", "737373", "525252", "404040", "262626", "171717", "0a0a0a"]],
  // prettier-ignore
  ["slate", ["f8fafc", "f1f5f9", "e2e8f0", "cbd5e1", "94a3b8", "64748b", "475569", "334155", "1e293b", "0f172a", "020617"]],
  // prettier-ignore
  ["gray", ["f9fafb", "f3f4f6", "e5e7eb", "d1d5db", "9ca3af", "6b7280", "4b5563", "374151", "1f2937", "111827", "030712"]],
  // prettier-ignore
  ["stone", ["fafaf9", "f5f5f4", "e7e5e4", "d6d3d1", "a8a29e", "78716c", "57534e", "44403c", "292524", "1c1917", "0c0a09"]],
];
const STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

export const PALETTE_NEUTRALS: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [family, hexes] of NEUTRAL_FAMILIES) {
    hexes.forEach((hex, i) => {
      if (!map.has(`#${hex}`)) map.set(`#${hex}`, `${family}-${STEPS[i]}`);
    });
  }
  return map;
})();

/** Lower-cases and expands #rgb; alpha forms (#rgba / #rrggbbaa) return null and are never mapped. */
export function normalizeHex(hex: string): string | null {
  const h = hex.replace(/^#/, "").toLowerCase();
  if (h.length === 3) return `#${[...h].map((c) => c + c).join("")}`;
  return h.length === 6 ? `#${h}` : null;
}

function strip(m: TokenMatch): TokenMatch {
  return { utility: m.utility, cssVar: m.cssVar, source: m.source };
}

function usable(m: TokenMatch, target: Target): boolean {
  return target === "css" || m.utility !== null;
}

function matchToken(value: string, role: Role, scope: Scope, target: Target): TokenMatch | null {
  const hit = TOKENS.find(
    (t) =>
      t.roles.includes(role) &&
      (scope === "light" ? t.light : t.dark) === value &&
      usable(t, target)
  );
  return hit ? strip(hit) : null;
}

function matchPalette(value: string): TokenMatch | null {
  const name = PALETTE_NEUTRALS.get(value);
  return name ? { utility: name, cssVar: `--color-${name}`, source: "palette" } : null;
}

export interface MapOptions {
  target?: Target;
  /** Tier 2 (Tailwind neutral palette); default true. */
  palette?: boolean;
}

/** The mapper: hex + where it is used → a token, or null (leave it and report it). */
export function mapHex(
  hex: string,
  role: Role,
  scope: Scope,
  { target = "class", palette = true }: MapOptions = {}
): TokenMatch | null {
  const value = normalizeHex(hex);
  if (!value) return null;
  return matchToken(value, role, scope, target) ?? (palette ? matchPalette(value) : null);
}

// ─── Context classification ────────────────────────────────────────────────

/** Areas whose colours are data (series palettes, map paint, flags, card art, fixtures…). */
export const DATA_PATHS: readonly RegExp[] = [
  /\/maps?\//,
  /\/charts?\//,
  /\/[^/]*[Cc]hart[^/]*\.tsx?$/,
  /\/cards?\//,
  /\/flags?\//,
  /\/heraldry\//,
  /\/sports?\//,
  /\/worldgen\//,
  /\/vexel\//,
  /\/demo-seed\//,
  /\/emails?\//,
  /opengraph-image|twitter-image|\/og\//,
  /\/tests?\/|\.test\.tsx?$|\.spec\.tsx?$/,
  /\/lib\/themes\/themes\.ts$/,
  /color-picker/,
  /^src\/server\//,
  // Standalone documents without the app stylesheet (API-rendered SVG): a var(--token) there
  // resolves to nothing.
  /^src\/app\/api\//,
];

/** Line-level data signals: SVG/canvas paint props, map paint keys, and inline palettes. */
const DATA_CONTEXT =
  /\b(fill|stroke|stopColor|floodColor|lightingColor|fillStyle|strokeStyle|shadowColor)\b\s*[=:]\s*\{?\s*["'`]?$|["'][a-z-]*-color["']\s*:\s*["'`]?$|\b[\w]*(palette|Palette|PALETTE|COLORS|gradient|Gradient)\b/;
const HEX_RE = /(?<![\w&#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;

export function isDataPath(file: string): boolean {
  return DATA_PATHS.some((re) => re.test(file));
}

function blank(text: string): string {
  return text.replace(/[^\n]/g, " ");
}

/** Replaces comment characters with spaces (same length, newlines kept); strings are skipped. */
export function maskTsComments(src: string): string {
  const re =
    /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
  return src.replace(re, (m: string, comment: string | undefined) => (comment ? blank(m) : m));
}

export function maskCssComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, blank);
}

function lineOf(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

function linePrefix(src: string, index: number): string {
  return src.slice(src.lastIndexOf("\n", index - 1) + 1, index);
}

function lineAt(src: string, index: number): string {
  const end = src.indexOf("\n", index);
  return src.slice(src.lastIndexOf("\n", index - 1) + 1, end === -1 ? src.length : end);
}

function isFallback(prefix: string): boolean {
  return /var\(\s*--[\w-]+\s*,[^()]*$/.test(prefix);
}

function isTokenDef(prefix: string): boolean {
  return /--[\w-]+["']?\s*:\s*["'`]?\s*$/.test(prefix);
}

function applyEdits(src: string, edits: readonly Edit[]): string {
  let out = src;
  for (const e of [...edits].sort((x, y) => y.start - x.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

// ─── (a) Tailwind arbitrary colour classes ─────────────────────────────────

const CLASS_RE =
  /(?<![\w-])(bg|text|border(?:-[xytrblse])?|from|via|to|ring(?:-offset)?|outline|decoration|divide|placeholder|caret|accent|fill|stroke|shadow)-\[(#[0-9a-fA-F]{3,8})\](\/(?:\d{1,3}|\[[\d.]+%?\]))?(?![\w\]-])/g;

const CLASS_ROLES: Record<string, Role> = {
  bg: "surface",
  from: "surface",
  via: "surface",
  to: "surface",
  text: "text",
  placeholder: "text",
  caret: "text",
  decoration: "text",
  fill: "paint",
  stroke: "paint",
  accent: "paint",
  shadow: "paint",
};

export function classRole(utility: string): Role {
  return CLASS_ROLES[utility] ?? "border";
}

function classScope(src: string, index: number): Scope {
  const variants = /[^\s"'`]*$/.exec(src.slice(Math.max(0, index - 120), index))?.[0] ?? "";
  return /(?:^|:)dark:/.test(variants) ? "dark" : "unscoped";
}

// ─── (b) JSX style={{…}} props ─────────────────────────────────────────────

const STYLE_PROP_RE = /\b([a-zA-Z]+)\s*:\s*(["'])(#[0-9a-fA-F]{3,8})\2/g;

export function styleRole(key: string): Role | null {
  if (/^(color|caretColor|textDecorationColor)$/.test(key)) return "text";
  if (/^background(Color)?$/.test(key)) return "surface";
  if (/^(border(Top|Right|Bottom|Left|Block|Inline)?(Start|End)?Color|outlineColor)$/.test(key)) {
    return "border";
  }
  return /^(fill|stroke)$/.test(key) ? "paint" : null;
}

function findStyleSpans(masked: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const m of masked.matchAll(/\bstyle=\{\{/g)) {
    const start = (m.index ?? 0) + m[0].length - 1;
    let depth = 0;
    let i = start;
    for (; i < masked.length; i++) {
      if (masked[i] === "{") depth++;
      else if (masked[i] === "}" && --depth === 0) break;
    }
    spans.push([start, i]);
  }
  return spans;
}

// ─── (b) CSS declarations ──────────────────────────────────────────────────

const CSS_ROLES: ReadonlyArray<[RegExp, Role]> = [
  [/^(color|caret-color|text-decoration-color|-webkit-text-fill-color|column-rule-color)$/, "text"],
  [/^background(-color)?$/, "surface"],
  [
    /^(border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?)$/,
    "border",
  ],
  [/^(fill|stroke|stop-color|flood-color)$/, "paint"],
];

export function cssRole(prop: string): Role | null {
  return CSS_ROLES.find(([re]) => re.test(prop))?.[1] ?? null;
}

interface Block {
  open: number;
  close: number;
  selector: string;
}

function cssBlocks(masked: string): Block[] {
  const blocks: Block[] = [];
  const stack: Array<{ open: number; selector: string }> = [];
  let boundary = 0;
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === "{") {
      stack.push({ open: i, selector: masked.slice(boundary, i).trim() });
      boundary = i + 1;
    } else if (ch === "}") {
      const top = stack.pop();
      if (top) blocks.push({ ...top, close: i });
      boundary = i + 1;
    } else if (ch === ";") {
      boundary = i + 1;
    }
  }
  return blocks;
}

const LIGHT_RE = /\.light(?![\w-])|\[data-theme=["']?light|prefers-color-scheme:\s*light/;
const DARK_RE = /\.dark(?![\w-])|\[data-theme=["']?dark|prefers-color-scheme:\s*dark/;

function selectorScope(selector: string): "light" | "dark" | "print" | null {
  if (/^@media\b[^{]*\bprint\b/.test(selector)) return "print";
  // `html:not([data-theme="dark"])` also matches before hydration sets the theme: not a scope.
  const parts = selector.split(",").map((p) => p.replace(/:not\([^)]*\)/g, ""));
  if (parts.every((p) => LIGHT_RE.test(p))) return "light";
  if (parts.every((p) => DARK_RE.test(p))) return "dark";
  return null;
}

/** Theme scope of a CSS position; null = print or contradictory (never mapped). */
export function cssScopeAt(blocks: readonly Block[], index: number): Scope | null {
  const found = new Set(
    blocks.filter((b) => b.open < index && index < b.close).map((b) => selectorScope(b.selector))
  );
  if (found.has("print") || (found.has("light") && found.has("dark"))) return null;
  if (found.has("light")) return "light";
  return found.has("dark") ? "dark" : "unscoped";
}

function declarationAt(masked: string, index: number): { prop: string; before: string } {
  const start = Math.max(masked.lastIndexOf(";", index), masked.lastIndexOf("{", index)) + 1;
  const decl = masked.slice(start, index);
  const colon = decl.indexOf(":");
  return {
    prop: colon === -1 ? "" : decl.slice(0, colon).trim().toLowerCase(),
    before: colon === -1 ? decl : decl.slice(colon + 1),
  };
}

function insideFunction(before: string): boolean {
  return before.split("(").length > before.split(")").length;
}

// ─── File transforms ───────────────────────────────────────────────────────

interface Ctx {
  file: string;
  src: string;
  masked: string;
  styleSpans: Array<[number, number]>;
  palette: boolean;
  sites: Site[];
  edits: Edit[];
  seen: Set<number>;
}

function record(ctx: Ctx, index: number, hex: string, kind: SiteKind, mapped: TokenMatch | null) {
  ctx.seen.add(index);
  ctx.sites.push({ file: ctx.file, line: lineOf(ctx.src, index), hex, kind, mapped });
}

function genericKind(ctx: Ctx, index: number): SiteKind | null {
  if (ctx.masked[index] !== "#") return "comment";
  const prefix = linePrefix(ctx.src, index);
  if (isTokenDef(prefix)) return "token-def";
  if (isFallback(prefix)) return "fallback";
  return isDataPath(ctx.file) ? "data" : null;
}

function tsClassPass(ctx: Ctx) {
  for (const m of ctx.masked.matchAll(CLASS_RE)) {
    const at = m.index ?? 0;
    const hexAt = at + m[0].indexOf("#");
    const kind = genericKind(ctx, hexAt);
    if (kind) continue;
    const [whole, util = "", hex = "", opacity = ""] = m;
    const mapped = mapHex(hex, classRole(util), classScope(ctx.src, at), {
      target: "class",
      palette: ctx.palette,
    });
    record(ctx, hexAt, hex, "class", mapped);
    if (mapped?.utility) {
      ctx.edits.push({
        start: at,
        end: at + whole.length,
        text: `${util}-${mapped.utility}${opacity}`,
      });
    }
  }
}

function tsStylePass(ctx: Ctx) {
  for (const [start, end] of ctx.styleSpans) {
    const span = ctx.masked.slice(start, end);
    for (const m of span.matchAll(STYLE_PROP_RE)) {
      const [, key = "", , hex = ""] = m;
      const hexAt = start + (m.index ?? 0) + m[0].indexOf("#");
      const role = styleRole(key);
      if (!role || genericKind(ctx, hexAt)) continue;
      const mapped = mapHex(hex, role, "unscoped", { target: "css", palette: ctx.palette });
      record(ctx, hexAt, hex, "style", mapped);
      if (mapped)
        ctx.edits.push({ start: hexAt, end: hexAt + hex.length, text: `var(${mapped.cssVar})` });
    }
  }
}

function tsLeftoverKind(ctx: Ctx, index: number): SiteKind {
  const prefix = linePrefix(ctx.src, index);
  if (/\[[^\]\s"'`]*$/.test(prefix)) return "class-complex";
  if (DATA_CONTEXT.test(prefix) || (lineAt(ctx.src, index).match(HEX_RE)?.length ?? 0) >= 3) {
    return "data";
  }
  const inStyle = ctx.styleSpans.some(([s, e]) => s < index && index < e);
  return inStyle ? "style-complex" : "js-literal";
}

/** Facet material & texture rules paint fixed physical palettes (paper, rubber, wood…): art. */
const ART_SELECTOR = /\.facet-(material|texture)-/;

function isArt(blocks: readonly Block[], index: number): boolean {
  return blocks.some((b) => b.open < index && index < b.close && ART_SELECTOR.test(b.selector));
}

function cssKind(
  ctx: Ctx,
  blocks: readonly Block[],
  index: number,
  hex: string
): TokenMatch | null {
  if (isArt(blocks, index)) {
    record(ctx, index, hex, "data", null);
    return null;
  }
  const { prop, before } = declarationAt(ctx.masked, index);
  const role = cssRole(prop);
  const scope = cssScopeAt(blocks, index);
  if (!role || !scope || insideFunction(before)) {
    record(ctx, index, hex, "css-effect", null);
    return null;
  }
  const mapped = mapHex(hex, role, scope, { target: "css", palette: ctx.palette });
  record(ctx, index, hex, "css", mapped);
  return mapped;
}

function cssPass(ctx: Ctx) {
  const blocks = cssBlocks(ctx.masked);
  for (const m of ctx.src.matchAll(HEX_RE)) {
    const at = m.index ?? 0;
    if (genericKind(ctx, at)) continue;
    const mapped = cssKind(ctx, blocks, at, m[0]);
    if (mapped) ctx.edits.push({ start: at, end: at + m[0].length, text: `var(${mapped.cssVar})` });
  }
}

function leftoverPass(ctx: Ctx, isCss: boolean) {
  for (const m of ctx.src.matchAll(HEX_RE)) {
    const at = m.index ?? 0;
    if (ctx.seen.has(at)) continue;
    const kind = genericKind(ctx, at) ?? (isCss ? "css-effect" : tsLeftoverKind(ctx, at));
    record(ctx, at, m[0], kind, null);
  }
}

/** Classifies every hex in one file and returns the rewritten source. */
export function transformSource(
  file: string,
  src: string,
  { palette = true }: { palette?: boolean } = {}
): { output: string; sites: Site[] } {
  const isCss = file.endsWith(".css");
  const masked = isCss ? maskCssComments(src) : maskTsComments(src);
  const styleSpans = isCss ? [] : findStyleSpans(masked);
  const ctx: Ctx = {
    file,
    src,
    masked,
    styleSpans,
    palette,
    sites: [],
    edits: [],
    seen: new Set(),
  };
  if (isCss) cssPass(ctx);
  else {
    tsClassPass(ctx);
    tsStylePass(ctx);
  }
  leftoverPass(ctx, isCss);
  ctx.sites.sort((a, b) => a.line - b.line);
  return { output: applyEdits(src, ctx.edits), sites: ctx.sites };
}

// ─── Inventory buckets ─────────────────────────────────────────────────────

export const BUCKETS: Record<SiteKind, string> = {
  class: "a",
  "class-complex": "a",
  style: "b",
  "style-complex": "b",
  css: "b",
  "css-effect": "b",
  "js-literal": "b?",
  data: "c",
  fallback: "n/a",
  "token-def": "n/a",
  comment: "n/a",
};

export function areaOf(file: string): string {
  const parts = file.replace(/^src\//, "").split("/");
  if (parts[0] === "styles" || parts.length < 3)
    return parts.length < 2 ? "(root)" : (parts[0] ?? "");
  return `${parts[0]}/${parts[1]}`;
}

function bump(table: Record<string, number>, key: string) {
  table[key] = (table[key] ?? 0) + 1;
}

export function summarize(sites: readonly Site[]) {
  const byKind: Record<string, number> = {};
  const byBucket: Record<string, number> = {};
  const byArea: Record<string, Record<string, number>> = {};
  for (const s of sites) {
    bump(byKind, s.kind);
    bump(byBucket, BUCKETS[s.kind]);
    const area = (byArea[areaOf(s.file)] ??= {});
    bump(area, BUCKETS[s.kind]);
    bump(area, "total");
    if (s.mapped) bump(area, "mapped");
  }
  return {
    total: sites.length,
    mapped: sites.filter((s) => s.mapped).length,
    byKind,
    byBucket,
    byArea,
  };
}

// ─── CLI ───────────────────────────────────────────────────────────────────

function walk(path: string, out: string[] = []): string[] {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) walk(join(path, entry), out);
  } else if (/\.(tsx?|css)$/.test(path) && !path.endsWith(".d.ts")) {
    out.push(path);
  }
  return out;
}

const TARGET_KINDS: ReadonlySet<SiteKind> = new Set(["class", "style", "css"]);

function describe(s: Site): string {
  return `    L${s.line} ${s.hex} [${s.kind}]`;
}

function runCLI() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const verbose = args.includes("--verbose");
  const palette = !args.includes("--no-palette");
  const reportAt = args.indexOf("--report");
  const reportFile = reportAt === -1 ? null : args[reportAt + 1];
  const paths = args.filter((a, i) => !a.startsWith("--") && i !== reportAt + 1);
  const root = process.cwd();
  const all: Site[] = [];
  let changedFiles = 0;
  for (const abs of (paths.length ? paths : ["src"]).flatMap((p) => walk(join(root, p)))) {
    const file = relative(root, abs);
    const src = readFileSync(abs, "utf8");
    const { output, sites } = transformSource(file, src, { palette });
    all.push(...sites);
    const targets = sites.filter((s) => TARGET_KINDS.has(s.kind));
    const hits = targets.filter((s) => s.mapped).length;
    if (!targets.length) continue;
    console.log(`${file}: ${hits} mapped, ${targets.length - hits} left`);
    if (verbose) targets.filter((s) => !s.mapped).forEach((s) => console.log(describe(s)));
    if (output !== src) {
      changedFiles++;
      if (!dry) writeFileSync(abs, output);
    }
  }
  const summary = summarize(all);
  console.log(
    `hex-to-tokens: ${summary.mapped} of ${summary.total} hex sites mapped in ${changedFiles} files${dry ? " (dry run)" : ""}`
  );
  console.log(`by class: ${JSON.stringify(summary.byBucket)}`);
  if (reportFile) writeFileSync(reportFile, JSON.stringify({ summary, sites: all }, null, 2));
}

if (process.argv[1]?.endsWith("hex-to-tokens.ts")) runCLI();
