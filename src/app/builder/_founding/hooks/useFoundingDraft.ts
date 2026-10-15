"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type RouterInputs } from "~/trpc/react";
import {
  emptyFoundingDraft,
  parseFoundingDraft,
  pickNewerDraft,
  type FoundingDraft,
} from "../lib/founding-draft";

/** The browser's crash copy of the draft. It never wins over a newer server draft. */
export const LOCAL_DRAFT_KEY = "ixstats:founding-draft";

/** How long the draft waits after the last change before it saves. */
export const DRAFT_SAVE_DELAY_MS = 2000;

type DraftJson = RouterInputs["builderDraft"]["save"]["data"];

export type DraftSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

function readLocalDraft(): FoundingDraft | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_DRAFT_KEY);
    return raw ? parseFoundingDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(draft: FoundingDraft) {
  try {
    window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the server copy still saves.
  }
}

function clearLocalDraft() {
  try {
    window.localStorage.removeItem(LOCAL_DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * The founding draft: loaded once from the server (or the newer local crash copy), changed with
 * `update`, and saved to the server two seconds after the last change.
 */
export function useFoundingDraft() {
  const query = api.builderDraft.get.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const { mutateAsync: saveDraft } = api.builderDraft.save.useMutation();
  const { mutateAsync: clearDraft } = api.builderDraft.clear.useMutation();

  const settled = query.isSuccess || query.isError;
  const serverData = query.data?.data;
  const loaded = useMemo(
    () =>
      settled
        ? (pickNewerDraft(parseFoundingDraft(serverData), readLocalDraft()) ?? emptyFoundingDraft())
        : null,
    [settled, serverData]
  );

  const [edited, setEdited] = useState<FoundingDraft | null>(null);
  const [status, setStatus] = useState<DraftSaveStatus>("idle");
  const draft = edited ?? loaded;
  // Set once the nation is founded: nothing may write the draft back after it is cleared.
  const discarded = useRef(false);

  const update = useCallback(
    (change: (current: FoundingDraft) => FoundingDraft) => {
      setEdited((previous) => {
        const base = previous ?? loaded;
        if (!base) return previous;
        const next = change(base);
        return next === base ? base : { ...next, updatedAt: Date.now() };
      });
      setStatus("pending");
    },
    [loaded]
  );

  const persist = useCallback(
    async (data: FoundingDraft) => {
      if (discarded.current) return;
      setStatus("saving");
      try {
        await saveDraft({ data: data as unknown as DraftJson });
        setStatus((current) => (current === "saving" ? "saved" : current));
      } catch {
        setStatus((current) => (current === "saving" ? "error" : current));
      }
    },
    [saveDraft]
  );

  useEffect(() => {
    if (!draft || status !== "pending" || discarded.current) return;
    writeLocalDraft(draft);
    const timer = setTimeout(() => void persist(draft), DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, status, persist]);

  const retry = useCallback(() => {
    if (draft) void persist(draft);
  }, [draft, persist]);

  /** After founding: the draft is done with, on the server and in the browser. */
  const discard = useCallback(async () => {
    discarded.current = true;
    setStatus("idle");
    clearLocalDraft();
    try {
      await clearDraft();
    } catch {
      // The next founding overwrites it.
    }
  }, [clearDraft]);

  return {
    draft,
    /** True when the flow resumed a draft saved earlier. */
    resumed: !!loaded && loaded.updatedAt > 0,
    status,
    update,
    retry,
    discard,
  };
}
