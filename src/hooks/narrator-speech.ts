"use client";
// The narrator's speech config loader and engine reporter (split out of useWikiNarrator).

import { useCallback, useRef } from "react";
import { api, type RouterOutputs } from "~/trpc/react";

type SpeechConfig = RouterOutputs["onoma"]["getSpeechConfig"];
type Engine = "kokoro" | "browser";

/**
 * The speech config (Kokoro settings), read on the first play, not for every reader: only a user who may use the
 * narrator, and has pressed play, needs it. The latest answer is kept in a ref for synchronous callbacks. (The
 * player reads the same cached query to label its engine.)
 */
export function useSpeechConfigLoader() {
  const utils = api.useUtils();
  const speechConfigRef = useRef<SpeechConfig | null>(null);
  const loadSpeechConfig = useCallback(async () => {
    try {
      speechConfigRef.current = await utils.onoma.getSpeechConfig.fetch(undefined, {
        staleTime: 600000,
      });
    } catch (err) {
      console.warn(
        "[Narrator] Could not read the speech config; reading with the browser voice.",
        err
      );
      speechConfigRef.current = null;
    }
    return speechConfigRef.current;
  }, [utils]);
  return { speechConfigRef, loadSpeechConfig };
}

/** Tells the player which voice is actually reading, so it can say so (only when it changes). */
export function useEngineReporter(setNarratorState: (state: { engine: Engine }) => void) {
  const engineRef = useRef<Engine | null>(null);
  return useCallback(
    (engine: Engine) => {
      if (engineRef.current === engine) return;
      engineRef.current = engine;
      setNarratorState({ engine });
    },
    [setNarratorState]
  );
}
