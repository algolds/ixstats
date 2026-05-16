"use client";

import { useState, useDeferredValue, useEffect } from "react";

export function useDeferredSearch<T>(fetcher: (query: string) => Promise<T>, delayMs = 300) {
  const [input, setInput] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(input), delayMs);
    return () => clearTimeout(timer);
  }, [input, delayMs]);

  const deferredInput = useDeferredValue(debouncedInput);
  const isStale = input !== debouncedInput;

  return { input, setInput, deferredInput, isStale };
}
