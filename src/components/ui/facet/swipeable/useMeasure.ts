"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Lightweight native measure hook replacing react-use-measure
 */
export function useMeasure<T extends HTMLElement = HTMLDivElement>() {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [element, setElement] = useState<T | null>(null);

  const ref = useCallback((node: T | null) => {
    setElement(node);
    if (node) {
      const rect = node.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setBounds({ width, height });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, bounds] as const;
}
