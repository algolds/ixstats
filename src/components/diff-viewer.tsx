import * as React from "react";
import { cn } from "~/lib/utils";
import { DiffViewerCopyButton } from "~/components/diff-viewer-client";
import {
  DiffTooLargeError,
  diffWikitext,
  type DiffHunk,
  type DiffRow as DiffLine,
  type WikitextDiff,
} from "~/lib/wiki-os/transformers/wikitext-diff";

type DiffLayout = "unified" | "split";

/** What the viewer draws: a line, or the unchanged stretch left out between two hunks. */
type DiffEntry = DiffLine | { type: "gap"; skipped: number };

interface WithStrings {
  oldCode: string;
  newCode: string;
  patch?: never;
  hunks?: never;
}

interface WithPatch {
  patch: string;
  oldCode?: never;
  newCode?: never;
  hunks?: never;
}

/** A diff the server already computed (an answer of `getDiff`): the viewer only draws it. */
interface WithHunks extends Partial<Omit<WikitextDiff, "hunks">> {
  hunks: readonly DiffHunk[];
  oldCode?: never;
  newCode?: never;
  patch?: never;
}

type DiffInput = WithStrings | WithPatch | WithHunks;

type DiffViewerProps = DiffInput &
  Omit<React.ComponentProps<"div">, "children"> & {
    layout?: DiffLayout;
    /** Shiki language key for syntax highlighting. Plain text when omitted. */
    language?: string;
    oldTitle?: string;
    newTitle?: string;
  };

function entriesFromPatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNum = 1;
  let newNum = 1;
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (match && match[1] && match[2]) {
        oldNum = parseInt(match[1], 10);
        newNum = parseInt(match[2], 10);
      }
      continue;
    }
    if (raw.startsWith("+")) {
      lines.push({ type: "added", content: raw.slice(1), oldNumber: null, newNumber: newNum++ });
    } else if (raw.startsWith("-")) {
      lines.push({ type: "removed", content: raw.slice(1), oldNumber: oldNum++, newNumber: null });
    } else if (raw.startsWith(" ")) {
      lines.push({
        type: "context",
        content: raw.slice(1),
        oldNumber: oldNum++,
        newNumber: newNum++,
      });
    }
  }
  return lines;
}

/** The rows of `hunks` in order, with a gap entry wherever unchanged lines were left out. */
function entriesFromHunks(hunks: readonly DiffHunk[], trailingSkipped = 0): DiffEntry[] {
  const entries = hunks.flatMap((hunk): DiffEntry[] =>
    hunk.skipped > 0 ? [{ type: "gap", skipped: hunk.skipped }, ...hunk.rows] : hunk.rows
  );
  return trailingSkipped > 0 ? [...entries, { type: "gap", skipped: trailingSkipped }] : entries;
}

interface Drawn {
  entries: DiffEntry[];
  /** Too many lines to show a diff at all. */
  tooLarge: boolean;
  /** Only the first changes are in `entries`. */
  truncated: boolean;
}

/** What to draw. Two texts are diffed here by the same bounded diff the server runs. */
function compute({
  hunks,
  patch,
  oldCode,
  newCode,
  trailingSkipped,
  tooLarge,
  truncated,
}: DiffInput & Pick<WikitextDiff, "trailingSkipped" | "tooLarge" | "truncated">): Drawn {
  if (hunks) {
    return {
      entries: entriesFromHunks(hunks, trailingSkipped),
      tooLarge: !!tooLarge,
      truncated: !!truncated,
    };
  }
  if (patch) return { entries: entriesFromPatch(patch), tooLarge: false, truncated: false };
  try {
    const diff = diffWikitext(oldCode ?? "", newCode ?? "", { context: Infinity });
    return {
      entries: entriesFromHunks(diff.hunks),
      tooLarge: !!diff.tooLarge,
      truncated: !!diff.truncated,
    };
  } catch (error) {
    if (error instanceof DiffTooLargeError)
      return { entries: [], tooLarge: true, truncated: false };
    throw error;
  }
}

function lineNumberWidth(entries: readonly DiffEntry[]): number {
  let max = 0;
  for (const entry of entries) {
    if (entry.type === "gap") continue;
    if (entry.oldNumber && entry.oldNumber > max) max = entry.oldNumber;
    if (entry.newNumber && entry.newNumber > max) max = entry.newNumber;
  }
  return Math.max(String(max).length, 2);
}

function lineColor(type: DiffLine["type"], element: "bg" | "text" | "num") {
  if (type === "added") {
    return element === "bg"
      ? "bg-emerald-500/10 dark:bg-emerald-500/10"
      : element === "num"
        ? "text-emerald-700/70 dark:text-emerald-400/50"
        : "text-emerald-900 dark:text-emerald-200";
  }
  if (type === "removed") {
    return element === "bg"
      ? "bg-red-500/10 dark:bg-red-500/10"
      : element === "num"
        ? "text-red-700/70 dark:text-red-400/50"
        : "text-red-900 dark:text-red-200";
  }
  return element === "num" ? "text-muted-foreground/50" : "text-foreground/80";
}

function linePrefix(type: DiffLine["type"]) {
  if (type === "added") return "+";
  if (type === "removed") return "-";
  return " ";
}

/** A line's text, with the parts that changed from its counterpart highlighted (plain text, never markup). */
function LineContent({ line }: { line: DiffLine }) {
  if (!line.content) return <>{"\u00A0"}</>;
  if (!line.marks?.length) return <>{line.content}</>;

  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of line.marks) {
    if (start > at) parts.push(line.content.slice(at, start));
    parts.push(
      <mark
        key={start}
        className={cn(
          "rounded-sm text-inherit",
          line.type === "added" ? "bg-emerald-500/30" : "bg-red-500/30"
        )}
      >
        {line.content.slice(start, end)}
      </mark>
    );
    at = end;
  }
  if (at < line.content.length) parts.push(line.content.slice(at));
  return <>{parts}</>;
}

function GapRow({ skipped, colSpan }: { skipped: number; colSpan: number }) {
  return (
    <tr className="bg-muted/30">
      <td
        colSpan={colSpan}
        className="text-muted-foreground/70 px-3 py-0.5 text-center text-xs select-none"
      >
        … {skipped.toLocaleString()} unchanged {skipped === 1 ? "line" : "lines"} …
      </td>
    </tr>
  );
}

function UnifiedView({ entries, numWidth }: { entries: readonly DiffEntry[]; numWidth: number }) {
  return (
    <table className="w-full border-collapse font-mono text-[13px] leading-relaxed">
      <tbody>
        {entries.map((line, i) =>
          line.type === "gap" ? (
            <GapRow key={i} skipped={line.skipped} colSpan={4} />
          ) : (
            <tr key={i} className={cn(lineColor(line.type, "bg"))}>
              <td
                className={cn("px-2 text-right align-top select-none", lineColor(line.type, "num"))}
                style={{ minWidth: `${numWidth + 2}ch` }}
              >
                {line.oldNumber ?? ""}
              </td>
              <td
                className={cn("px-2 text-right align-top select-none", lineColor(line.type, "num"))}
                style={{ minWidth: `${numWidth + 2}ch` }}
              >
                {line.newNumber ?? ""}
              </td>
              <td
                className={cn(
                  "px-1 text-center align-top select-none",
                  lineColor(line.type, "num")
                )}
              >
                {linePrefix(line.type)}
              </td>
              <td className={cn("px-3 align-top whitespace-pre", lineColor(line.type, "text"))}>
                <LineContent line={line} />
              </td>
            </tr>
          )
        )}
      </tbody>
    </table>
  );
}

type SplitCell = DiffEntry | null;

/** Pairs removed and added lines side by side; a gap spans both columns. */
function splitColumns(entries: readonly DiffEntry[]): { left: SplitCell[]; right: SplitCell[] } {
  const left: SplitCell[] = [];
  const right: SplitCell[] = [];

  let i = 0;
  while (i < entries.length) {
    const entry = entries[i]!;

    if (entry.type === "context" || entry.type === "gap") {
      left.push(entry);
      right.push(entry);
      i++;
    } else if (entry.type === "removed") {
      const removed: DiffEntry[] = [];
      while (i < entries.length && entries[i]!.type === "removed") removed.push(entries[i++]!);
      const added: DiffEntry[] = [];
      while (i < entries.length && entries[i]!.type === "added") added.push(entries[i++]!);

      const maxLen = Math.max(removed.length, added.length);
      for (let j = 0; j < maxLen; j++) {
        left.push(removed[j] ?? null);
        right.push(added[j] ?? null);
      }
    } else {
      left.push(null);
      right.push(entry);
      i++;
    }
  }
  return { left, right };
}

function SplitColumn({
  cells,
  side,
  numWidth,
}: {
  cells: readonly SplitCell[];
  side: "old" | "new";
  numWidth: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[13px] leading-relaxed">
        <tbody>
          {cells.map((line, idx) =>
            line?.type === "gap" ? (
              <GapRow key={idx} skipped={line.skipped} colSpan={2} />
            ) : (
              <tr key={idx} className={cn(line ? lineColor(line.type, "bg") : "")}>
                <td
                  className={cn(
                    "px-2 text-right align-top select-none",
                    line ? lineColor(line.type, "num") : "text-muted-foreground/30"
                  )}
                  style={{ minWidth: `${numWidth + 2}ch` }}
                >
                  {(side === "old" ? line?.oldNumber : line?.newNumber) ?? ""}
                </td>
                <td
                  className={cn(
                    "px-3 align-top whitespace-pre",
                    line ? lineColor(line.type, "text") : ""
                  )}
                >
                  {line ? <LineContent line={line} /> : "\u00A0"}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function SplitView({ entries, numWidth }: { entries: readonly DiffEntry[]; numWidth: number }) {
  const { left, right } = splitColumns(entries);
  return (
    <div className="divide-border/40 grid grid-cols-2 divide-x">
      <SplitColumn cells={left} side="old" numWidth={numWidth} />
      <SplitColumn cells={right} side="new" numWidth={numWidth} />
    </div>
  );
}

export function DiffViewer({
  layout = "unified",
  oldTitle,
  newTitle,
  className,
  oldCode,
  newCode,
  patch,
  hunks,
  trailingSkipped,
  tooLarge,
  truncated,
  added,
  removed,
  ...props
}: DiffViewerProps) {
  const drawn = compute({
    ...(hunks
      ? { hunks }
      : patch !== undefined
        ? { patch }
        : { oldCode: oldCode ?? "", newCode: newCode ?? "" }),
    trailingSkipped,
    tooLarge,
    truncated,
  });
  const { entries } = drawn;
  const numWidth = lineNumberWidth(entries);

  const stats = { added: added ?? 0, removed: removed ?? 0 };
  if (added === undefined && removed === undefined) {
    for (const entry of entries) {
      if (entry.type === "added") stats.added++;
      if (entry.type === "removed") stats.removed++;
    }
  }

  const fullCode = entries.flatMap((e) => (e.type === "gap" ? [] : [e.content])).join("\n");
  const showHeader = oldTitle || newTitle;

  return (
    <div
      data-slot="diff-viewer"
      className={cn(
        "border-border/60 bg-card relative overflow-hidden rounded-xl border shadow-sm",
        className
      )}
      {...props}
    >
      {showHeader && (
        <div className="border-border/60 bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="flex items-center gap-3 text-sm">
            {oldTitle && <span className="text-muted-foreground">{oldTitle}</span>}
            {oldTitle && newTitle && <span className="text-muted-foreground/40">→</span>}
            {newTitle && <span className="text-foreground font-medium">{newTitle}</span>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              {stats.added > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">+{stats.added}</span>
              )}
              {stats.removed > 0 && (
                <span className="text-red-600 dark:text-red-400">-{stats.removed}</span>
              )}
            </div>
            <DiffViewerCopyButton value={fullCode} />
          </div>
        </div>
      )}

      {!showHeader && (
        <div className="absolute top-2 right-2 z-10">
          <DiffViewerCopyButton value={fullCode} />
        </div>
      )}

      <div className="overflow-x-auto">
        {drawn.tooLarge ? (
          <p role="status" className="text-muted-foreground px-4 py-6 text-center text-sm">
            This diff is too large to display
            {added !== undefined && removed !== undefined
              ? ` (${added.toLocaleString()} lines added, ${removed.toLocaleString()} removed)`
              : ""}
            .
          </p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">
            There are no differences.
          </p>
        ) : layout === "split" ? (
          <SplitView entries={entries} numWidth={numWidth} />
        ) : (
          <UnifiedView entries={entries} numWidth={numWidth} />
        )}
        {drawn.truncated && !drawn.tooLarge && (
          <p
            role="status"
            className="border-border/40 text-muted-foreground border-t px-4 py-3 text-center text-xs"
          >
            This diff is too large to display in full; only the first changes are shown.
          </p>
        )}
      </div>
    </div>
  );
}
