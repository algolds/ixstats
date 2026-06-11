"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FacetTabItem } from "./types";

export function useTabBounds(tabs: FacetTabItem[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<Record<string, { left: number; width: number }>>({});

  const measureTabs = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const buttons = containerRef.current.querySelectorAll("button[data-tab-id]");
    const newBounds: Record<string, { left: number; width: number }> = {};
    
    buttons.forEach((btn) => {
      const id = btn.getAttribute("data-tab-id");
      if (id) {
        const rect = btn.getBoundingClientRect();
        newBounds[id] = {
          left: rect.left - containerRect.left,
          width: rect.width,
        };
      }
    });
    
    setBounds(newBounds);
  }, []);

  // Update bounds on mount, tabs change, or resize
  useEffect(() => {
    measureTabs();
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      measureTabs();
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [measureTabs, tabs]);

  return {
    bounds,
    containerRef,
    measureTabs,
  };
}
