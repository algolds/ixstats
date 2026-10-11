"use client";

import { useEffect, useRef } from "react";
import { actionToken, isActivityId } from "~/lib/action-links";
import { ATTACH_PARAM } from "~/lib/thinkpages-forum/links";

/** Animation frames to wait for the editor to exist (it loads on demand): about two seconds. */
export const PREFILL_MAX_FRAMES = 120;

/** The activity id the address asks to attach, or null: absent, or not shaped like an id. */
export function attachIdFromAddress(search: string): string | null {
  const raw = new URLSearchParams(search).get(ATTACH_PARAM);
  return raw !== null && isActivityId(raw) ? raw : null;
}

/** Removes the parameter from the address without a navigation, keeping the other parameters and the hash. */
export function dropAttachParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(ATTACH_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Inserts the action named by `?attach=<activity id>` into a composer, once: a share from MyCountry opens the composer
 * with the action already in it. The address is read in an effect (no router hook, so no Suspense boundary is needed).
 * The editor loads on demand, so `tryInsert` is asked on each animation frame until it reports the token is in the
 * draft (returns true) or the frame limit passes; the parameter is then removed, so a refresh does not insert it
 * twice. A value that is not shaped like an id is ignored; one that is shaped like an id but is not the poster's own
 * action fails at post time, like a hand-typed token (nothing here says whether an id exists). `null` turns the hook
 * off (a composer that does not prefill).
 */
export function useAttachPrefill(tryInsert: ((token: string) => boolean) | null): void {
  const insertRef = useRef(tryInsert);
  insertRef.current = tryInsert;
  const enabled = tryInsert !== null;
  const done = useRef(false);

  useEffect(() => {
    if (!enabled || done.current) return;
    const id = attachIdFromAddress(window.location.search);
    if (!id) return;
    let frames = 0;
    let handle = 0;
    const tick = () => {
      if (insertRef.current?.(actionToken(id))) {
        done.current = true;
        dropAttachParam();
        return;
      }
      frames += 1;
      if (frames < PREFILL_MAX_FRAMES) handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [enabled]);
}
