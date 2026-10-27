/**
 * src/lib/wiki-os/wikitext/blank.ts — whitespace by character code, for scans that must not use a regular
 * expression where a blank run could make it quadratic.
 */

/** Whether the UTF-16 code is one `\s` matches (and `trim()` strips: the same set). */
export function isBlank(code: number): boolean {
  return (
    (code >= 9 && code <= 13) ||
    code === 32 ||
    code === 160 ||
    code === 5760 ||
    (code >= 8192 && code <= 8202) ||
    code === 8232 ||
    code === 8233 ||
    code === 8239 ||
    code === 8287 ||
    code === 12288 ||
    code === 65279
  );
}

/** The index of the first character at or after `from` that is not a blank (the end of the text when none). */
export function skipBlanks(text: string, from: number): number {
  let at = from;
  while (isBlank(text.charCodeAt(at))) at++;
  return at;
}

/** `[lead, core, trail]`: `text` as its leading blanks, what is between, and its trailing blanks (what `/^(\s*)([\s\S]*?)(\s*)$/` captures). */
export function splitBlanks(text: string): [lead: string, core: string, trail: string] {
  let from = 0;
  while (from < text.length && isBlank(text.charCodeAt(from))) from++;
  let to = text.length;
  while (to > from && isBlank(text.charCodeAt(to - 1))) to--;
  return [text.slice(0, from), text.slice(from, to), text.slice(to)];
}
