"use client";

import { useCallback, useState } from "react";
import type { ForumReward } from "~/lib/action-rewards";
import { useRewardLine } from "./RewardSignal";

export type CanvasPhase =
  { kind: "idle" } | { kind: "sending" } | { kind: "pending" } | { kind: "error"; message: string };

interface SendResult {
  formatting: "done" | "pending";
  reward?: ForumReward | null;
}

/**
 * Sending a Canvas post: the outcome of the last save (a refusal, "formatting will finish shortly", the reward it
 * earned) until the next edit makes it stale. `onPosted` runs after a save that should start the next post blank
 * (a reply or thread, never an edit).
 */
export function useCanvasSend(
  save: () => Promise<SendResult>,
  startsBlank: boolean,
  onPosted: () => void
) {
  const [phase, setPhase] = useState<CanvasPhase>({ kind: "idle" });
  const { reward, show, clear } = useRewardLine();

  /** An edit makes the last save's outcome stale. */
  const settle = useCallback(() => {
    clear();
    setPhase((current) => (current.kind === "sending" ? current : { kind: "idle" }));
  }, [clear]);

  const send = useCallback(async () => {
    setPhase({ kind: "sending" });
    clear();
    try {
      const { formatting, reward: earned } = await save();
      setPhase(formatting === "pending" ? { kind: "pending" } : { kind: "idle" });
      show(earned);
      if (startsBlank) onPosted();
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Could not post" });
    }
  }, [save, startsBlank, onPosted, clear, show]);

  return { phase, reward, settle, send };
}
