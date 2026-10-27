"use client";

import { useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { useDebounce } from "~/hooks/useDebounce";
import type { FoundingDraft } from "../lib/founding-draft";
import { previewInput, type PreviewFoundingInput } from "../lib/founding-payload";
import type { FoundingSummary } from "../lib/founding-format";

/** The nation card waits this long after the last change before it asks the server again. */
export const PREVIEW_DEBOUNCE_MS = 400;

const NO_INPUT: PreviewFoundingInput = {};

/**
 * The live nation card's figures: `countries.previewFounding` for the current draft, asked 400ms
 * after the last change that moves a number. The previous figures stay while new ones load.
 *
 * `summary` follows the Figure rule: undefined while the first result loads, null when the
 * preview failed.
 */
export function useFoundingPreview(draft: FoundingDraft | null): {
  summary: FoundingSummary | null | undefined;
  /** Showing earlier figures while newer ones load. */
  stale: boolean;
} {
  // A string key: the draft changes on every keystroke, the figures' inputs far less often.
  const key = useMemo(() => (draft ? JSON.stringify(previewInput(draft)) : ""), [draft]);
  const settledKey = useDebounce(key, PREVIEW_DEBOUNCE_MS);
  const input = useMemo(
    () => (settledKey ? (JSON.parse(settledKey) as PreviewFoundingInput) : NO_INPUT),
    [settledKey]
  );
  const query = api.countries.previewFounding.useQuery(input, {
    enabled: settledKey !== "",
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const summary = query.data ?? (query.isError ? null : undefined);
  const stale =
    summary != null && (key !== settledKey || (query.isFetching && query.isPlaceholderData));
  return { summary, stale };
}
