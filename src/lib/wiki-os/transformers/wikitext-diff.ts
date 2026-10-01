/**
 * wikitext-diff.ts — the line diff of two revisions, computed once, on the server.
 *
 * A Myers O(ND) diff over interned lines, cut down to hunks of ±3 lines of context. A changed line
 * that has a counterpart on the other side (the first removed line with the first added one, and so
 * on) also carries the character ranges that differ, so the UI marks words, never HTML.
 *
 * Bounded on every axis: 2 MB per side, an edit distance and a step budget. A diff past the last
 * two is not refused: the lines between the common head and tail are shown as removed and added.
 */

/** Largest text compared, per side. */
export const DIFF_MAX_BYTES_PER_SIDE = 2 * 1024 * 1024;
/** Lines of unchanged text kept on each side of a change. */
export const DIFF_CONTEXT_LINES = 3;
/** Longest line compared word by word with its counterpart. */
const WORD_DIFF_MAX_LINE = 2000;
/** Most changed line pairs compared word by word in one diff. */
const MAX_MARKED_PAIRS = 500;
/** Edit distance (inserted + deleted lines) past which the lines between head and tail are replaced. */
const MAX_LINE_EDIT_DISTANCE = 3000;
/** The same for the words of one line pair. */
const MAX_WORD_EDIT_DISTANCE = 400;
/** Inner steps one search may take before it gives up on the shortest script. */
const MAX_STEPS = 40_000_000;

/** A character range `[start, end)` of a line's content that differs from its counterpart. */
export type DiffMark = readonly [start: number, end: number];

export interface DiffRow {
  type: "context" | "added" | "removed";
  content: string;
  /** 1-based line number in the older text; null for an added line. */
  oldNumber: number | null;
  /** 1-based line number in the newer text; null for a removed line. */
  newNumber: number | null;
  /** The parts of the line that changed, for a line with a counterpart. */
  marks?: DiffMark[];
}

export interface DiffHunk {
  /** Unchanged lines left out between the previous hunk (or the top of the text) and this one. */
  skipped: number;
  rows: DiffRow[];
}

export interface WikitextDiff {
  hunks: DiffHunk[];
  added: number;
  removed: number;
}

export class DiffTooLargeError extends Error {
  constructor() {
    super(
      `A revision is larger than ${DIFF_MAX_BYTES_PER_SIDE / (1024 * 1024)} MB and cannot be compared here.`
    );
    this.name = "DiffTooLargeError";
  }
}

export interface DiffOptions {
  /** Unchanged lines kept around a change; Infinity keeps every line. */
  context?: number;
}

/** One step of an edit script: keep an item, delete one of the older text, insert one of the newer. */
const KEEP = 0;
const DELETE = 1;
const INSERT = 2;
type EditOp = typeof KEEP | typeof DELETE | typeof INSERT;

interface Budget {
  steps: number;
}

// ─── Myers ────────────────────────────────────────────────────────

/** The values of `v` on the diagonals round `round` reached: -round, -round + 2, … round. */
function snapshot(v: Int32Array, offset: number, round: number): Int32Array {
  const copy = new Int32Array(round + 1);
  for (let i = 0; i <= round; i++) copy[i] = v[offset - round + 2 * i]!;
  return copy;
}

/** Walks the trace from the end back to the start and returns the ops in text order. */
function backtrack(trace: readonly Int32Array[], n: number, m: number, distance: number): EditOp[] {
  const ops: EditOp[] = [];
  let x = n;
  let y = m;
  for (let d = distance; d > 0; d--) {
    const before = trace[d - 1]!;
    // before[i] is the furthest x on diagonal -(d - 1) + 2i
    const at = (k: number): number => before[(k + d - 1) >> 1]!;
    const k = x - y;
    const fromAbove = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const prevK = fromAbove ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push(KEEP);
      x--;
      y--;
    }
    ops.push(x === prevX ? INSERT : DELETE);
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    ops.push(KEEP);
    x--;
    y--;
  }
  return ops.reverse();
}

/**
 * The shortest edit script from `a` to `b` (arrays of interned symbols), or null when it takes more
 * than `maxDistance` edits or the step budget. The script lists the ops in text order.
 */
function shortestEdit(
  a: readonly number[],
  b: readonly number[],
  maxDistance: number,
  budget: Budget
): EditOp[] | null {
  const n = a.length;
  const m = b.length;
  const limit = Math.min(n + m, maxDistance);
  const offset = limit + 1;
  const v = new Int32Array(2 * limit + 3);
  // trace[d - 1] holds v as it was before round d: the furthest points of round d - 1
  const trace: Int32Array[] = [];

  for (let d = 0; d <= limit; d++) {
    if (d > 0) trace.push(snapshot(v, offset, d - 1));
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!);
      const startX = down ? v[offset + k + 1]! : v[offset + k - 1]! + 1;
      let x = startX;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      budget.steps -= x - startX + 1;
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, n, m, d);
    }
    if (budget.steps < 0) return null;
  }
  return null;
}

/** Within each run of edits, the deletions first: a changed block reads "removed, then added". */
function deletionsFirst(ops: readonly EditOp[]): EditOp[] {
  const sorted: EditOp[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i] === KEEP) {
      sorted.push(KEEP);
      i++;
      continue;
    }
    let deletions = 0;
    let insertions = 0;
    for (; i < ops.length && ops[i] !== KEEP; i++) {
      if (ops[i] === DELETE) deletions++;
      else insertions++;
    }
    for (let d = 0; d < deletions; d++) sorted.push(DELETE);
    for (let n = 0; n < insertions; n++) sorted.push(INSERT);
  }
  return sorted;
}

/**
 * The edit script between two symbol arrays: the common head and tail are peeled off first (almost
 * every revision is a small change to a large text), Myers runs on the middle, and a middle too far
 * apart is simply replaced.
 */
function editScript(
  a: readonly number[],
  b: readonly number[],
  maxDistance: number,
  budget: Budget
): EditOp[] {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++;
  }
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const middle = shortestEdit(midA, midB, maxDistance, budget) ?? [
    ...midA.map((): EditOp => DELETE),
    ...midB.map((): EditOp => INSERT),
  ];
  return [
    ...Array.from({ length: head }, (): EditOp => KEEP),
    ...deletionsFirst(middle),
    ...Array.from({ length: tail }, (): EditOp => KEEP),
  ];
}

/** Gives each distinct string the same small integer on both sides. */
function intern(a: readonly string[], b: readonly string[]): [number[], number[]] {
  const ids = new Map<string, number>();
  const idOf = (item: string): number => {
    let id = ids.get(item);
    if (id === undefined) {
      id = ids.size;
      ids.set(item, id);
    }
    return id;
  };
  return [a.map(idOf), b.map(idOf)];
}

// ─── Word marks ───────────────────────────────────────────────────

const WORD_TOKEN = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

interface Token {
  text: string;
  start: number;
}

function tokenize(line: string): Token[] {
  return Array.from(line.matchAll(WORD_TOKEN), (match) => ({ text: match[0], start: match.index }));
}

/** Adds a range, merging it into the last one when they touch, so "a b" → "c d" is one mark. */
function pushMark(marks: [number, number][], start: number, end: number): void {
  const last = marks[marks.length - 1];
  if (last && last[1] >= start) last[1] = end;
  else marks.push([start, end]);
}

/** The ranges of `tokens` that `ops` deletes (side DELETE) or inserts (side INSERT). */
function markedRanges(
  tokens: readonly Token[],
  ops: readonly EditOp[],
  side: typeof DELETE | typeof INSERT
): [number, number][] {
  const marks: [number, number][] = [];
  let index = 0;
  for (const op of ops) {
    if (op === KEEP || op === side) {
      const token = tokens[index++]!;
      if (op === side) pushMark(marks, token.start, token.start + token.text.length);
    }
  }
  return marks;
}

const coversLine = (marks: readonly DiffMark[], line: string): boolean =>
  marks.length === 1 && marks[0]![0] === 0 && marks[0]![1] === line.length;

/**
 * The character ranges that differ between a removed line and the added line that replaces it, or
 * null when either is too long to compare or the two share nothing worth marking.
 */
function wordMarks(
  oldLine: string,
  newLine: string
): { old: DiffMark[]; added: DiffMark[] } | null {
  if (oldLine.length > WORD_DIFF_MAX_LINE || newLine.length > WORD_DIFF_MAX_LINE) return null;
  const oldTokens = tokenize(oldLine);
  const newTokens = tokenize(newLine);
  const [oldIds, newIds] = intern(
    oldTokens.map((t) => t.text),
    newTokens.map((t) => t.text)
  );
  const ops = editScript(oldIds, newIds, MAX_WORD_EDIT_DISTANCE, { steps: MAX_STEPS });
  const old = markedRanges(oldTokens, ops, DELETE);
  const added = markedRanges(newTokens, ops, INSERT);
  return coversLine(old, oldLine) && coversLine(added, newLine) ? null : { old, added };
}

/** Attaches word marks to the i-th removed line and the i-th added line of each change. */
function markChangedPairs(rows: DiffRow[], budget: { pairs: number }): void {
  let i = 0;
  while (i < rows.length && budget.pairs > 0) {
    if (rows[i]!.type === "context") {
      i++;
      continue;
    }
    const removedStart = i;
    while (i < rows.length && rows[i]!.type === "removed") i++;
    const addedStart = i;
    while (i < rows.length && rows[i]!.type === "added") i++;
    const pairs = Math.min(addedStart - removedStart, i - addedStart, budget.pairs);
    budget.pairs -= pairs;
    for (let p = 0; p < pairs; p++) {
      const removed = rows[removedStart + p]!;
      const added = rows[addedStart + p]!;
      const marks = wordMarks(removed.content, added.content);
      if (marks?.old.length) removed.marks = marks.old;
      if (marks?.added.length) added.marks = marks.added;
    }
  }
}

// ─── Hunks ────────────────────────────────────────────────────────

/** Whether `text` is over the size limit, without encoding it when its length already decides. */
function exceedsLimit(text: string): boolean {
  if (text.length > DIFF_MAX_BYTES_PER_SIDE) return true;
  if (text.length * 3 <= DIFF_MAX_BYTES_PER_SIDE) return false;
  return new TextEncoder().encode(text).length > DIFF_MAX_BYTES_PER_SIDE;
}

/** Every line of both texts as a row, in order, with its line numbers. */
function rowsOf(
  ops: readonly EditOp[],
  oldLines: readonly string[],
  newLines: readonly string[]
): DiffRow[] {
  const rows: DiffRow[] = [];
  let o = 0;
  let n = 0;
  for (const op of ops) {
    if (op === KEEP) {
      rows.push({ type: "context", content: oldLines[o]!, oldNumber: ++o, newNumber: ++n });
    } else if (op === DELETE) {
      rows.push({ type: "removed", content: oldLines[o]!, oldNumber: ++o, newNumber: null });
    } else {
      rows.push({ type: "added", content: newLines[n]!, oldNumber: null, newNumber: ++n });
    }
  }
  return rows;
}

/** Cuts `rows` into hunks: each change with `context` unchanged rows each side, close ones merged. */
function toHunks(rows: readonly DiffRow[], context: number): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let hunkEnd = 0; // exclusive end of the previous hunk
  let i = 0;
  while (i < rows.length) {
    if (rows[i]!.type === "context") {
      i++;
      continue;
    }
    // `i` opens a hunk; it runs on while another change lies within 2 * context unchanged rows
    let last = i;
    for (let j = i + 1; j < rows.length && j - last <= 2 * context + 1; j++) {
      if (rows[j]!.type !== "context") last = j;
    }
    const start = Math.max(hunkEnd, i - context);
    const end = Math.min(rows.length, last + context + 1);
    hunks.push({ skipped: start - hunkEnd, rows: rows.slice(start, end) });
    hunkEnd = end;
    i = end;
  }
  return hunks;
}

/**
 * The difference between two texts as hunks of ±`context` lines (3 by default). Throws
 * `DiffTooLargeError` for a text over 2 MB. Identical texts have no hunks.
 */
export function diffWikitext(
  oldText: string,
  newText: string,
  { context = DIFF_CONTEXT_LINES }: DiffOptions = {}
): WikitextDiff {
  if (exceedsLimit(oldText) || exceedsLimit(newText)) throw new DiffTooLargeError();

  const oldLines = oldText === "" ? [] : oldText.split("\n");
  const newLines = newText === "" ? [] : newText.split("\n");
  const [oldIds, newIds] = intern(oldLines, newLines);
  const ops = editScript(oldIds, newIds, MAX_LINE_EDIT_DISTANCE, { steps: MAX_STEPS });

  const hunks = toHunks(rowsOf(ops, oldLines, newLines), context);
  const pairBudget = { pairs: MAX_MARKED_PAIRS };
  for (const hunk of hunks) markChangedPairs(hunk.rows, pairBudget);
  return {
    hunks,
    added: ops.filter((op) => op === INSERT).length,
    removed: ops.filter((op) => op === DELETE).length,
  };
}
