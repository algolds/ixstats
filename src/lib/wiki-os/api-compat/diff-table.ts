/**
 * diff-table.ts — a `WikitextDiff` as MediaWiki's diff table rows (plan 410).
 *
 * WikiOS has one diff engine (`diffWikitext`, plan 413): it finds the changed lines, the unchanged
 * context around them and the words that differ. `action=compare` only lays that result out as the
 * `<tr>` rows MediaWiki's tools expect, and stops once the rows pass a size limit.
 */

import { ApiError } from "./errors";
import type { DiffMark, DiffRow, WikitextDiff } from "~/lib/wiki-os/transformers/wikitext-diff";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const NO_CHANGES = '<tr><td colspan="4" class="diff-empty">No changes</td></tr>';

/** `content` escaped, with each marked range (the words that differ) inside `<tag class="diffchange diffchange-inline">`; the whole line when no range is given. */
function markedContent(content: string, marks: readonly DiffMark[] | undefined, tag: "ins" | "del"): string {
  const open = `<${tag} class="diffchange diffchange-inline">`;
  const close = `</${tag}>`;
  if (!marks || marks.length === 0) return `${open}${escapeHtml(content)}${close}`;
  let html = "";
  let at = 0;
  for (const [start, end] of marks) {
    if (start < at || end > content.length) continue; // the engine's ranges are ordered and inside the line
    html += escapeHtml(content.slice(at, start)) + open + escapeHtml(content.slice(start, end)) + close;
    at = end;
  }
  return html + escapeHtml(content.slice(at));
}

function rowHtml(row: DiffRow): string {
  switch (row.type) {
    case "context":
      return (
        `<tr><td class="diff-marker" data-marker=" "></td><td class="diff-context">${escapeHtml(row.content)}</td>` +
        `<td class="diff-marker" data-marker=" "></td><td class="diff-context">${escapeHtml(row.content)}</td></tr>`
      );
    case "removed":
      return (
        `<tr><td class="diff-marker" data-marker="−"></td>` +
        `<td class="diff-deletedline">${markedContent(row.content, row.marks, "del")}</td>` +
        `<td class="diff-marker"></td><td class="diff-empty"></td></tr>`
      );
    case "added":
      return (
        `<tr><td class="diff-marker"></td><td class="diff-empty"></td>` +
        `<td class="diff-marker" data-marker="+"></td>` +
        `<td class="diff-addedline">${markedContent(row.content, row.marks, "ins")}</td></tr>`
      );
  }
}

/**
 * The diff's rows joined by line breaks, as `action=compare` answers them. A diff the engine would not
 * compare (too many lines) or had to cut (too many rows), or one whose rows pass `maxChars`, is `toobig`:
 * a partial table would read as a smaller change than the real one.
 */
export function diffTableHtml(diff: WikitextDiff, maxChars: number): string {
  if (diff.tooLarge || diff.truncated) throw new ApiError("toobig", "The diff is too large to show.");
  const rows: string[] = [];
  let chars = 0;
  for (const hunk of diff.hunks) {
    for (const row of hunk.rows) {
      const html = rowHtml(row);
      chars += html.length + 1;
      if (chars > maxChars) throw new ApiError("toobig", "The diff is larger than 2 MB.");
      rows.push(html);
    }
  }
  return rows.length === 0 ? NO_CHANGES : rows.join("\n");
}
