"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "~/trpc/react";

export interface HandleGate {
  /** True at once when the player has a passport handle; else asks for one and answers whether they picked it. */
  ensureHandle(): Promise<boolean>;
  /** Spread onto `HandlePickerDialog`. */
  dialog: { open: boolean; onDone(): void; onCancel(): void };
}

/**
 * WikiOS signs a player's edits with their passport handle (design decision 9), and the server refuses a save without
 * one. This gate asks a handle-less player to pick one before their first save goes out. When the status cannot be
 * read (signed out, or the read failed), the save goes on and the server decides.
 */
export function useHandleGate(): HandleGate {
  const utils = api.useUtils();
  const { data: status } = api.ixnayid.getStatus.useQuery();
  const [open, setOpen] = useState(false);
  const answer = useRef<((picked: boolean) => void) | null>(null);

  const settle = useCallback((picked: boolean) => {
    setOpen(false);
    answer.current?.(picked);
    answer.current = null;
  }, []);

  const ensureHandle = useCallback(async () => {
    const current = status ?? (await utils.ixnayid.getStatus.fetch().catch(() => null));
    if (!current || current.handle) return true;
    return new Promise<boolean>((resolve) => {
      answer.current = resolve;
      setOpen(true);
    });
  }, [status, utils]);

  return {
    ensureHandle,
    dialog: { open, onDone: () => settle(true), onCancel: () => settle(false) },
  };
}
