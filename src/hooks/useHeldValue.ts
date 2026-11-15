"use client";

import { useState } from "react";

/**
 * The latest `value` seen while `capture` was true, held while it is false (e.g. a total that should not shrink while
 * a filter narrows the list). Updates during render, so it never reads a ref and needs no effect.
 */
export function useHeldValue<T>(value: T, capture: boolean): T {
  const [held, setHeld] = useState(value);
  if (capture && !Object.is(held, value)) setHeld(value);
  return capture ? value : held;
}
