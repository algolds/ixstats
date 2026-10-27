/**
 * Run `fn` at most once per animation frame, with the latest value scheduled. Pointer events can
 * arrive several times per frame; work done for the ones in between is never seen.
 */
export function coalesceToFrame<T>(fn: (value: T) => void) {
  let pending: { value: T } | null = null;
  let frame = 0;

  const run = () => {
    frame = 0;
    const job = pending;
    pending = null;
    if (job) fn(job.value);
  };

  return {
    schedule(value: T) {
      pending = { value };
      if (!frame) frame = requestAnimationFrame(run);
    },
    /** Apply the pending value now (e.g. on mouse-up, so the result matches the last pointer). */
    flush() {
      if (frame) cancelAnimationFrame(frame);
      run();
    },
    cancel() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pending = null;
    },
  };
}
