"use client";

import { useCallback, useState } from "react";
import { api } from "~/trpc/react";

export type CanvasView = "write" | "preview";
export type CanvasPreview =
  | { kind: "loading" }
  | { kind: "ready"; html: string; pending: boolean }
  | { kind: "error"; message: string };

/** The Write / Preview switch; opening Preview renders the draft on the server (nothing is saved). */
export function useCanvasPreview(wikitext: string, threadId: string | undefined) {
  const [view, setView] = useState<CanvasView>("write");
  const [preview, setPreview] = useState<CanvasPreview | null>(null);
  const { mutateAsync: previewPost } = api.thinkpagesForum.previewPost.useMutation();

  const changeView = useCallback(
    async (next: CanvasView) => {
      setView(next);
      if (next !== "preview") return;
      setPreview({ kind: "loading" });
      try {
        const out = await previewPost({ wikitext, threadId });
        setPreview({ kind: "ready", html: out.html, pending: out.pending });
      } catch (e) {
        setPreview({
          kind: "error",
          message: e instanceof Error ? e.message : "Could not preview",
        });
      }
    },
    [previewPost, wikitext, threadId]
  );

  return { view, preview, changeView };
}
