"use client";
import { useState } from "react";

/**
 * The target a confirmation dialog acts on, and the one it shows. `shown` is set on open and kept after close, so a
 * closing dialog keeps its copy through the exit animation instead of flashing its fallback.
 */
export function useDialogTarget<T>() {
  const [target, setTarget] = useState<T | null>(null);
  const [shown, setShown] = useState<T | null>(null);
  return {
    target,
    shown,
    open: (next: T) => {
      setShown(next);
      setTarget(next);
    },
    close: () => setTarget(null),
  };
}
