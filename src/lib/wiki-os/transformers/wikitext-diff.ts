/**
 * wikitext-diff.ts — Node.js diff engine for WikiOS.
 *
 * Replaces MediaWiki's action=compare API call with a pure Node.js implementation.
 * Generates a two-column HTML diff table matching MediaWiki's diff format.
 */

/** The diff would be longer than `maxOutputChars`: nothing is built past that point. */
export class DiffTooLarge extends Error {
  constructor() {
    super("The diff is larger than the limit");
    this.name = "DiffTooLarge";
  }
}

export interface DiffOptions {
  /** Stop with `DiffTooLarge` once the rows come to more than this many characters (default: no limit). */
  maxOutputChars?: number;
}

/**
 * Compute a line-level diff between two wikitext strings
 * and produce an HTML table similar to MediaWiki's diff output.
 * Linear in the number of lines once the inputs are too large for the exact algorithm.
 */
export function computeWikitextDiff(
  oldText: string,
  newText: string,
  { maxOutputChars = Number.POSITIVE_INFINITY }: DiffOptions = {}
): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Compute LCS-based diff using Myers algorithm (simplified)
  const changes = diffLines(oldLines, newLines);

  if (changes.length === 0) {
    return '<tr><td colspan="4" class="diff-empty">No changes</td></tr>';
  }

  const rows: string[] = [];
  let outputChars = 0;
  const addRow = (row: string): void => {
    outputChars += row.length + 1;
    if (outputChars > maxOutputChars) throw new DiffTooLarge();
    rows.push(row);
  };

  for (const [changeIndex, change] of changes.entries()) {
    // Decided once per change, not once per line (it looks at the neighbouring changes).
    const showContext = change.type === "equal" && isNearChange(changes, changeIndex, 3);
    switch (change.type) {
      case "equal":
        for (const line of change.lines) {
          // Context line (show a few around changes)
          if (showContext) {
            addRow(
              `<tr>` +
                `<td class="diff-marker" data-marker=" "></td>` +
                `<td class="diff-context">${escapeHtml(line)}</td>` +
                `<td class="diff-marker" data-marker=" "></td>` +
                `<td class="diff-context">${escapeHtml(line)}</td>` +
                `</tr>`
            );
          }
        }
        break;

      case "delete":
        for (const line of change.lines) {
          addRow(
            `<tr>` +
              `<td class="diff-marker" data-marker="−"></td>` +
              `<td class="diff-deletedline"><del class="diffchange diffchange-inline">${escapeHtml(line)}</del></td>` +
              `<td class="diff-marker"></td>` +
              `<td class="diff-empty"></td>` +
              `</tr>`
          );
        }
        break;

      case "insert":
        for (const line of change.lines) {
          addRow(
            `<tr>` +
              `<td class="diff-marker"></td>` +
              `<td class="diff-empty"></td>` +
              `<td class="diff-marker" data-marker="+"></td>` +
              `<td class="diff-addedline"><ins class="diffchange diffchange-inline">${escapeHtml(line)}</ins></td>` +
              `</tr>`
          );
        }
        break;

      case "replace":
        // Show deleted lines first, then added lines
        for (const line of change.oldLines) {
          addRow(
            `<tr>` +
              `<td class="diff-marker" data-marker="−"></td>` +
              `<td class="diff-deletedline"><del class="diffchange diffchange-inline">${escapeHtml(line)}</del></td>` +
              `<td class="diff-marker"></td>` +
              `<td class="diff-empty"></td>` +
              `</tr>`
          );
        }
        for (const line of change.newLines) {
          addRow(
            `<tr>` +
              `<td class="diff-marker"></td>` +
              `<td class="diff-empty"></td>` +
              `<td class="diff-marker" data-marker="+"></td>` +
              `<td class="diff-addedline"><ins class="diffchange diffchange-inline">${escapeHtml(line)}</ins></td>` +
              `</tr>`
          );
        }
        break;
    }
  }

  return rows.join("\n");
}

// ─── Internal diff algorithm ──────────────────────────────────────

type DiffChange =
  | { type: "equal"; lines: string[] }
  | { type: "delete"; lines: string[] }
  | { type: "insert"; lines: string[] }
  | { type: "replace"; oldLines: string[]; newLines: string[] };

function diffLines(oldLines: string[], newLines: string[]): DiffChange[] {
  // Compute edit script using patience-like diff
  const lcs = longestCommonSubsequence(oldLines, newLines);
  const changes: DiffChange[] = [];

  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (li < lcs.length && oi === lcs[li]![0] && ni === lcs[li]![1]) {
      // Common line
      const equalLines: string[] = [];
      while (li < lcs.length && oi === lcs[li]![0] && ni === lcs[li]![1]) {
        equalLines.push(oldLines[oi]!);
        oi++;
        ni++;
        li++;
      }
      changes.push({ type: "equal", lines: equalLines });
    } else {
      // Find next matching point
      const nextMatch = li < lcs.length ? lcs[li]! : [oldLines.length, newLines.length];
      const deletedLines = oldLines.slice(oi, nextMatch[0]);
      const insertedLines = newLines.slice(ni, nextMatch[1]);

      if (deletedLines.length > 0 && insertedLines.length > 0) {
        changes.push({ type: "replace", oldLines: deletedLines, newLines: insertedLines });
      } else if (deletedLines.length > 0) {
        changes.push({ type: "delete", lines: deletedLines });
      } else if (insertedLines.length > 0) {
        changes.push({ type: "insert", lines: insertedLines });
      }

      oi = nextMatch[0];
      ni = nextMatch[1];
    }
  }

  return changes;
}

/**
 * Compute LCS as pairs of [oldIndex, newIndex].
 */
function longestCommonSubsequence(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;

  // For very large diffs, use a simpler O(mn) DP
  // but cap at reasonable size to avoid OOM
  if (m * n > 5_000_000) {
    return simpleLCS(a, b);
  }

  // Standard DP
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to find LCS pairs
  const result: [number, number][] = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }

  return result.reverse();
}

/**
 * Simple LCS for very large inputs — uses hash-based matching. Each line's candidate positions are
 * walked once (a pointer per distinct line only moves forward), so it is linear in the line count
 * even when one line is repeated a hundred thousand times.
 */
function simpleLCS(a: string[], b: string[]): [number, number][] {
  const positions = new Map<string, { indices: number[]; next: number }>();
  for (let j = 0; j < b.length; j++) {
    const line = b[j]!;
    const entry = positions.get(line);
    if (entry) entry.indices.push(j);
    else positions.set(line, { indices: [j], next: 0 });
  }

  const result: [number, number][] = [];
  let lastJ = -1;

  for (let i = 0; i < a.length; i++) {
    const entry = positions.get(a[i]!);
    if (!entry) continue;
    // `lastJ` only grows, so positions at or before it are never useful again for this line.
    while (entry.next < entry.indices.length && entry.indices[entry.next]! <= lastJ) entry.next++;
    const j = entry.indices[entry.next];
    if (j !== undefined) {
      result.push([i, j]);
      lastJ = j;
    }
  }

  return result;
}

/** Whether the equal block `changes[idx]` is shown in full: the first and last block, or one beside a change, or a short one. */
function isNearChange(changes: DiffChange[], idx: number, context: number): boolean {
  const current = changes[idx]!;
  if (idx <= 0 || idx >= changes.length - 1) return true;

  // Check if there's a non-equal change within context lines
  const prev = changes[idx - 1];
  const next = changes[idx + 1];
  if (prev && prev.type !== "equal") return true;
  if (next && next.type !== "equal") return true;

  // For equal blocks, show first/last N lines if adjacent to changes
  if (current.type === "equal" && current.lines.length <= context * 2) return true;

  return false;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
