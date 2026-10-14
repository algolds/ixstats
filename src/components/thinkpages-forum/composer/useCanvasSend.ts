"use client";

import { useCallback, useState } from "react";

export type CanvasPhase =
  { kind: "idle" } | { kind: "sending" } | { kind: "pending" } | { kind: "error"; message: string };

interface SendResult {
  formatting: "done" | "pending";
}

/**
 * Sending a Canvas post: the outcome of the last save (a refusal, "formatting will finish shortly") until the next edit makes it stale. `onPosted` runs after a save that should start the next post blank
 * (a reply or thread, never an edit).
 */
export function useCanvasSend(
  save: () => Promise<SendResult>,
  startsBlank: boolean,
  onPosted: () => void
) {
  const [phase, setPhase] = useState<CanvasPhase>({ kind: "idle" });
  /** An edit makes the last save's outcome stale. */
  const settle = useCallback(() => {
    setPhase((current) => (current.kind === "sending" ? current : { kind: "idle" }));
  }, []);

  const send = useCallback(async () => {
    setPhase({ kind: "sending" });
    try {
      const { formatting } = await save();
      setPhase(formatting === "pending" ? { kind: "pending" } : { kind: "idle" });
      if (startsBlank) onPosted();
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Could not post" });
    }
  }, [save, startsBlank, onPosted]);

  return { phase, settle, send };
}
