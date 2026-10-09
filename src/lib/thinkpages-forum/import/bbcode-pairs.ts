/**
 * Linear-time BBCode tag pairing for the transformer (bbcode.ts). A regex such as `/\[b\]([\s\S]*?)\[\/b\]/gi`
 * backtracks quadratically on many unclosed openers: each opener scans to the end of the post for its closer. The
 * scanner here gives the same matches, finding each closer once and stopping at the first opener that has none
 * (no later opener can have one either).
 */

export interface PairSpec {
  /** The tag name, lowercase letters and digits only (matched case-insensitively). */
  tag: string;
  /**
   * The rest of the opener after `[tag`, through its `]`, as a sticky (`y`) regex whose groups reach `render`. It
   * must not match a `]` before its last character, so every opener ends at the first `]` after its name.
   */
  rest: RegExp;
  /** A sticky regex the whole content must match (the pair is skipped otherwise), e.g. `/\d+/y`. */
  body?: RegExp;
  /** Innermost pairs only: content holding another `[tag` is skipped, so the caller can work outward. */
  innermost?: boolean;
  render: (opener: RegExpExecArray, content: string) => string;
}

type Finder = (from: number) => { index: number; end: number } | null;

/**
 * The first match of `pattern` at or after `from`. Calls come with a non-decreasing `from`, so the last answer is
 * reused while `from` has not passed it, and the text is scanned once overall.
 */
function finderOf(html: string, pattern: RegExp): Finder {
  let lastFrom = -1;
  let last: ReturnType<Finder> = null;
  return (from) => {
    if (lastFrom >= 0 && from >= lastFrom && (last === null || from <= last.index)) return last;
    pattern.lastIndex = from;
    const hit = pattern.exec(html);
    lastFrom = from;
    last = hit ? { index: hit.index, end: hit.index + hit[0].length } : null;
    return last;
  };
}

const bodyFits = (html: string, body: RegExp | undefined, start: number, end: number): boolean => {
  if (!body) return true;
  body.lastIndex = start;
  return body.exec(html) !== null && body.lastIndex === end;
};

/** Replaces each `[tag…]content[/tag]` pair as `spec` describes; text outside the pairs is kept as is. */
export function replacePairs(html: string, spec: PairSpec): string {
  const head = new RegExp(`\\[${spec.tag}(?=[\\]=\\s])`, "gi");
  const closer = finderOf(html, new RegExp(`\\[\\/${spec.tag}\\]`, "gi"));
  const inner = finderOf(html, new RegExp(`\\[${spec.tag}`, "gi"));
  const lastBracket = html.lastIndexOf("]");
  let out = "";
  let from = 0;
  for (let open = head.exec(html); open && head.lastIndex <= lastBracket; open = head.exec(html)) {
    spec.rest.lastIndex = head.lastIndex;
    const opener = spec.rest.exec(html);
    if (!opener) continue;
    const start = spec.rest.lastIndex;
    const close = closer(start);
    if (!close) break;
    const nested = spec.innermost ? inner(start) : null;
    if (nested && nested.index < close.index) {
      head.lastIndex = nested.index;
      continue;
    }
    // Every opener before this one's `]` ends there too, with the same content: skip them all.
    if (!bodyFits(html, spec.body, start, close.index)) {
      head.lastIndex = start;
      continue;
    }
    out += html.slice(from, open.index) + spec.render(opener, html.slice(start, close.index));
    from = close.end;
    head.lastIndex = from;
  }
  return out + html.slice(from);
}
