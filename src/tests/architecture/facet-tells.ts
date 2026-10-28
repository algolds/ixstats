import fs from "fs";
import path from "path";

/** Each tell the sweep removes. Counts are matches on non-comment lines of .tsx files. */
export const TELLS: Record<string, RegExp> = {
  eyebrow: /<Eyebrow\b|\btext-eyebrow\b/g,
  statLabel: /\btext-stat-label\b/g,
  emDash: /—/g,
  // Also catches `Spark as Sparkles` import aliases, which hid decorative sparks from the bare name.
  sparks: /\bSparks\b|\bSpark\s+as\s+\w+/g,
  // Engines disagree on some code points: V8 (Node) counts U+2605 ★ as Extended_Pictographic,
  // JavaScriptCore (Bun, which CI runs Jest under) does not. Excluding them keeps the count
  // identical whichever runtime writes the baseline.
  emoji: /(?![\u2605])\p{Extended_Pictographic}/gu,
  hoverScale: /\bhover:scale-/g,
  hexClass: /\[#[0-9a-fA-F]{3,8}\]/g,
  rawPalette:
    /\b(?:bg|text|border|from|via|to|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
  animatePing: /\banimate-ping\b/g,
  // Springs come from src/lib/design/motion.ts; a literal stiffness is an ad hoc spring.
  adhocSpring: /\bstiffness\s*:\s*\d+/g,
};

export function walkTsx(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walkTsx(p) : e.name.endsWith(".tsx") ? [p] : [];
  });
}

export const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\s*\/\*)/.test(line);
