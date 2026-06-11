/**
 * wikitext-diff.ts — Node.js diff engine for WikiOS.
 *
 * Replaces MediaWiki's action=compare API call with a pure Node.js implementation.
 * Generates a two-column HTML diff table matching MediaWiki's diff format.
 */

/**
 * Compute a line-level diff between two wikitext strings
 * and produce an HTML table similar to MediaWiki's diff output.
 */
export function computeWikitextDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Compute LCS-based diff using Myers algorithm (simplified)
  const changes = diffLines(oldLines, newLines);

  if (changes.length === 0) {
    return '<tr><td colspan="4" class="diff-empty">No changes</td></tr>';
  }

  const rows: string[] = [];

  for (const change of changes) {
    switch (change.type) {
      case "equal":
        for (const line of change.lines) {
          // Context line (show a few around changes)
          if (isNearChange(changes, change, 3)) {
            rows.push(
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
          rows.push(
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
          rows.push(
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
          rows.push(
            `<tr>` +
              `<td class="diff-marker" data-marker="−"></td>` +
              `<td class="diff-deletedline"><del class="diffchange diffchange-inline">${escapeHtml(line)}</del></td>` +
              `<td class="diff-marker"></td>` +
              `<td class="diff-empty"></td>` +
              `</tr>`
          );
        }
        for (const line of change.newLines) {
          rows.push(
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
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0) as number[]);

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
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Simple LCS for very large inputs — uses hash-based matching.
 */
function simpleLCS(a: string[], b: string[]): [number, number][] {
  const bMap = new Map<string, number[]>();
  for (let j = 0; j < b.length; j++) {
    const line = b[j]!;
    if (!bMap.has(line)) bMap.set(line, []);
    bMap.get(line)!.push(j);
  }

  const result: [number, number][] = [];
  let lastJ = -1;

  for (let i = 0; i < a.length; i++) {
    const indices = bMap.get(a[i]!);
    if (!indices) continue;
    for (const j of indices) {
      if (j > lastJ) {
        result.push([i, j]);
        lastJ = j;
        break;
      }
    }
  }

  return result;
}

function isNearChange(changes: DiffChange[], current: DiffChange, context: number): boolean {
  const idx = changes.indexOf(current);
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
