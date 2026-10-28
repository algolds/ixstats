"use client";
// The article page's mode (reading, or the source/visual editor) and its address. Leaving the editor pushes the
// reading address, but the router's search params catch up a render later; an address that still says
// `?action=edit` must not reopen the editor then (it did: a save never returned to the article, and Cancel left the
// editor up on the page's text). The address opens the editor only when it turns to `?action=edit` (back/forward).

import { useState } from "react";
import type { ArticleMode } from "~/lib/wiki-os/types";

export function useArticleEditMode(
  editInAddress: boolean,
  initialMode: ArticleMode
): readonly [ArticleMode, (mode: ArticleMode) => void] {
  const [mode, setMode] = useState<ArticleMode>(initialMode);
  const [addressSeen, setAddressSeen] = useState(editInAddress);
  if (editInAddress !== addressSeen) {
    setAddressSeen(editInAddress);
    if (editInAddress && mode === "reading") setMode("source");
  }
  return [mode, setMode] as const;
}
