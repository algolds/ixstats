import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

const refusalSchema = z.object({
  data: z.object({ context: z.object({ retryAfterSeconds: z.number().positive() }) }),
});

/** The wait a slow-mode refusal carries (`error.data.context.retryAfterSeconds`), in whole seconds; null for any other error. */
export function retryAfterSecondsOf(error: Error): number | null {
  const refusal = refusalSchema.safeParse(error);
  return refusal.success ? Math.ceil(refusal.data.data.context.retryAfterSeconds) : null;
}

/** A once-a-second countdown to the time the member may post again. */
export function useSlowMode() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  const active = remaining > 0;

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const start = useCallback((seconds: number) => {
    const at = Date.now();
    setNow(at);
    setUntil(at + seconds * 1000);
  }, []);

  return { remaining, start };
}
