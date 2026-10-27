import { useRef } from "react";

/** A ref that always holds the latest value, so long-lived event callbacks never go stale. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  // oxlint-disable-next-line -- latest-value ref read by event callbacks
  ref.current = value;
  return ref;
}
