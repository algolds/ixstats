"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { GlassPlateEditorRef } from "~/components/shared/editor";
import { retryAfterSecondsOf } from "./useSlowMode";

interface BoardPostOptions<Input> {
  editorRef: RefObject<GlassPlateEditorRef | null>;
  onSubmit: (input: Input) => Promise<void>;
  /** Called once the message is posted, after the editor is cleared. */
  onPosted: () => void;
  /** Seconds of slow mode to start after a post (0 for none). */
  slowSeconds: number;
  startSlow: (seconds: number) => void;
}

/**
 * Sending a board message: pending and the server's refusal. A slow-mode refusal starts the
 * countdown instead of showing an error. The editor is read-only while a post is sent, which drops its focus: it is
 * taken back once the editor is writable again.
 */
export function useBoardPost<Input>({
  editorRef,
  onSubmit,
  onPosted,
  slowSeconds,
  startSlow,
}: BoardPostOptions<Input>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (pending || !refocus.current) return;
    refocus.current = false;
    editorRef.current?.focusEnd();
  }, [pending, editorRef]);

  const send = useCallback(
    async (input: Input) => {
      setPending(true);
      setError(null);
      try {
        await onSubmit(input);
        editorRef.current?.clear();
        onPosted();
        if (slowSeconds > 0) startSlow(slowSeconds);
      } catch (e) {
        const wait = e instanceof Error ? retryAfterSecondsOf(e) : null;
        if (wait) startSlow(wait);
        else setError(e instanceof Error ? e.message : "Could not post");
      } finally {
        refocus.current = true;
        setPending(false);
      }
    },
    [onSubmit, onPosted, slowSeconds, startSlow, editorRef]
  );

  return { pending, error, send };
}
