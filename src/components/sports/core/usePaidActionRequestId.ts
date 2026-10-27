"use client";

import { useCallback, useMemo, useRef } from "react";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The request id for one press of a paid MyClub action (stadium, patron saint, training, charter). The server
 * charges each id once (`sports:<action>:<userId>:<requestId>`), so a retry or re-submit of the same attempt can't
 * be charged twice. `idFor(attempt)` keeps returning the same id while `attempt` (the press's inputs, as a string)
 * is unchanged; other inputs, or `done()` after a success, start a new one.
 */
export function usePaidActionRequestId() {
  const current = useRef<{ attempt: string; id: string } | null>(null);
  return useMemo(
    () => ({
      idFor: (attempt: string) => {
        if (current.current?.attempt !== attempt) current.current = { attempt, id: newId() };
        return current.current.id;
      },
      done: () => {
        current.current = null;
      },
    }),
    []
  );
}

/**
 * A paid mutation's `mutateAsync` that sends the press's request id, keyed by the rest of the input (so a
 * resubmitted form reuses it and an edited one gets a new one), and starts a new id after a success.
 */
export function usePaidMutateAsync<I extends object, O>(
  mutateAsync: (input: I & { requestId?: string }) => Promise<O>
): (input: I) => Promise<O> {
  const request = usePaidActionRequestId();
  return useCallback(
    async (input: I) => {
      const result = await mutateAsync({
        ...input,
        requestId: request.idFor(JSON.stringify(input)),
      });
      request.done();
      return result;
    },
    [mutateAsync, request]
  );
}
