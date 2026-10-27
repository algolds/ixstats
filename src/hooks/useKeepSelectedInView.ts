"use client";

import { useEffect, useRef, type RefObject } from "react";

/** The row's selected item: a tab (`aria-selected`) or a radio (`aria-checked`). */
const SELECTED = ':scope > [aria-selected="true"], :scope > [aria-checked="true"]';

/** Scrolls `track` the least distance that shows all of `item`: the track only, never the page. */
function scrollIntoTrack(track: HTMLElement, item: Element) {
  const start = track.getBoundingClientRect().left + track.clientLeft;
  const end = start + track.clientWidth;
  const box = item.getBoundingClientRect();
  if (box.left < start) track.scrollLeft -= start - box.left;
  else if (box.right > end) track.scrollLeft += box.right - end;
}

function keepSelected(track: HTMLElement) {
  const item = track.querySelector(SELECTED);
  if (item) scrollIntoTrack(track, item);
}

interface KeepSelectedInViewOptions {
  /** Off for a row that never scrolls: nothing is watched. */
  enabled: boolean;
  /** The selected item's value; a change scrolls the new selection into view. */
  selected: string | undefined;
  /** Names the set of items, so items added later are watched too. */
  itemsKey?: string;
}

/**
 * Keeps the selected tab or segment of a horizontally scrolling row in view: when the selection changes, when an
 * item takes focus, and when the row or an item changes size (a count badge that arrives after first paint), unless
 * the player has scrolled the row by hand since the last selection.
 */
export function useKeepSelectedInView(
  trackRef: RefObject<HTMLElement | null>,
  { enabled, selected, itemsKey = "" }: KeepSelectedInViewOptions
): void {
  // Set by a pointer or wheel on the row, cleared by the next selection.
  const scrolledByHand = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track) return;
    scrolledByHand.current = false;
    keepSelected(track);
  }, [trackRef, enabled, selected]);

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track) return;
    const byHand = () => {
      scrolledByHand.current = true;
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target !== track) {
        scrollIntoTrack(track, event.target);
      }
    };
    track.addEventListener("pointerdown", byHand);
    track.addEventListener("wheel", byHand, { passive: true });
    track.addEventListener("focusin", onFocus);
    // A widening item changes the row's scroll width, not the row's own box, so the items are watched as well.
    const resized =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (!scrolledByHand.current) keepSelected(track);
          });
    for (const box of [track, ...Array.from(track.children)]) resized?.observe(box);
    return () => {
      track.removeEventListener("pointerdown", byHand);
      track.removeEventListener("wheel", byHand);
      track.removeEventListener("focusin", onFocus);
      resized?.disconnect();
    };
  }, [trackRef, enabled, itemsKey]);
}
