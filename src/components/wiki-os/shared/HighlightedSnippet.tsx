// src/components/wiki-os/shared/HighlightedSnippet.tsx
// A plain-text search snippet with the parts that matched the query marked. The server sends the
// text and character ranges (never HTML), so nothing in the snippet can become markup.

import { Fragment } from "react";

interface HighlightedSnippetProps {
  text: string;
  /** `[start, end)` character ranges of `text`, in order and not overlapping. */
  ranges?: ReadonlyArray<readonly [number, number]>;
}

export function HighlightedSnippet({ text, ranges }: HighlightedSnippetProps) {
  if (!ranges?.length) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start < at || end > text.length || end <= start) continue;
    if (start > at) parts.push(<Fragment key={`t${at}`}>{text.slice(at, start)}</Fragment>);
    parts.push(
      <mark key={`m${start}`} className="text-foreground rounded-sm bg-transparent font-semibold">
        {text.slice(start, end)}
      </mark>
    );
    at = end;
  }
  if (at < text.length) parts.push(<Fragment key={`t${at}`}>{text.slice(at)}</Fragment>);
  return <>{parts}</>;
}
