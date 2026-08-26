"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import { cn } from "~/lib/utils";

interface PreTextProps {
  children: React.ReactNode;
  font?: string;
  lineHeight?: number;
  className?: string;
  whiteSpace?: "normal" | "pre-wrap" | "nowrap";
  wordBreak?: "normal" | "keep-all";
  letterSpacing?: number;
}

export function PreText({
  children,
  font = "14px Inter, sans-serif",
  lineHeight = 20,
  className,
  whiteSpace = "normal",
  wordBreak = "normal",
  letterSpacing,
}: PreTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Set mounted flag on client
  useEffect(() => {
    // oxlint-disable-next-line
    setIsMounted(true);
  }, []);

  // Measure container width on mount and resize (client-only)
  useEffect(() => {
    if (whiteSpace === "nowrap") return;
    if (!isMounted || !containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setWidth(Math.floor(rect.width));
      }
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMounted, whiteSpace]);

  // Check if children is a plain string
  const isStringChild = typeof children === "string";

  // Prepare the text segments (client-only precomputation)
  const prepared: PreparedTextWithSegments | null = useMemo(() => {
    if (!isMounted || !isStringChild || whiteSpace === "nowrap") return null;
    try {
      return prepareWithSegments(children as string, font, {
        whiteSpace,
        wordBreak,
        letterSpacing,
      });
    } catch (e) {
      console.warn("PreText failed to prepare text:", e);
      return null;
    }
  }, [isMounted, children, font, whiteSpace, wordBreak, letterSpacing, isStringChild]);

  // Layout the text lines dynamically based on container width
  const layoutResult = useMemo(() => {
    if (!prepared || width <= 0) return null;
    try {
      return layoutWithLines(prepared, width, lineHeight);
    } catch (e) {
      console.warn("PreText failed to layout text:", e);
      return null;
    }
  }, [prepared, width, lineHeight]);

  // Short-circuit for nowrap to avoid layout loop on flex containers
  if (whiteSpace === "nowrap") {
    return (
      <span className={cn("inline-block max-w-full truncate text-inherit", className)}>
        {children}
      </span>
    );
  }

  if (!isStringChild) {
    // Fallback: render children normally if they are React Elements
    return (
      <div ref={containerRef} className={cn("w-full", className)}>
        {children}
      </div>
    );
  }

  // Render the precomputed text lines using standard block layout to keep dimensions stable
  return (
    <div ref={containerRef} className={cn("w-full select-text", className)}>
      {layoutResult ? (
        layoutResult.lines.map((line, index) => (
          <div
            key={index}
            className="w-full whitespace-nowrap text-inherit"
            style={{
              height: `${lineHeight}px`,
              lineHeight: `${lineHeight}px`,
            }}
          >
            {line.text}
          </div>
        ))
      ) : (
        /* Render normal text during SSR and before client-side measurement */
        <span className="text-inherit">{children}</span>
      )}
    </div>
  );
}
