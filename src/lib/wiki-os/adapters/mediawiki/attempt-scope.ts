/**
 * attempt-scope.ts — one time limit for everything one mirror attempt asks of MediaWiki.
 *
 * An attempt (a batch import, a move, ...) makes several calls: the login, the write, the checks, the fallback.
 * Each has its own timeout, but their sum is what the worker's lock has to outlast, so the attempt as a whole is
 * bounded too: `withinAttempt` opens a scope with one `AbortSignal`, and every request made inside it
 * (`requestSignal`) stops when that signal does, even a request still in flight, so a late write can never land after
 * the job was failed. Outside a scope a request has only its own timeout.
 */

import { AsyncLocalStorage } from "node:async_hooks";

const attempt = new AsyncLocalStorage<AbortSignal>();

/** Run `work` with `ms` for everything it asks of MediaWiki; its requests are aborted when the time is up. */
export function withinAttempt<T>(ms: number, work: () => Promise<T>): Promise<T> {
  return attempt.run(AbortSignal.timeout(ms), work);
}

/** The signal of a request that may take `ms` itself: it also stops when the enclosing attempt's time is up. */
export function requestSignal(ms: number): AbortSignal {
  const own = AbortSignal.timeout(ms);
  const enclosing = attempt.getStore();
  return enclosing ? AbortSignal.any([enclosing, own]) : own;
}
