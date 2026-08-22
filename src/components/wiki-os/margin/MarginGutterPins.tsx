// src/components/wiki-os/margin/MarginGutterPins.tsx
// Renders margin gutter pin indicators aligned with article headings, paragraphs, and annotations.
// Full Apple Design & Theme Compliance.

"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, Highlighter } from "lucide-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

export interface GutterPinItem {
  id: string;
  type: "thread" | "annotation";
  title: string;
  sectionAnchor?: string | null;
  count?: number;
  color?: string;
  top: number;
}

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MarginGutterPinsProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  threads: Array<{
    id: string;
    title: string;
    sectionAnchor: string | null;
    status: string;
  }>;
  annotations: Array<{
    id: string;
    selectedText: string;
    color: string;
  }>;
  onSelectAnchor: (anchor: string | null, threadId?: string, tab?: "threads" | "markup") => void;
  onOpenDrawer: () => void;
  themeColors?: ThemeColors | null;
}

export function MarginGutterPins({
  contentRef,
  threads,
  annotations,
  onSelectAnchor,
  onOpenDrawer,
  themeColors,
}: MarginGutterPinsProps) {
  const [pins, setPins] = useState<GutterPinItem[]>([]);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  const primaryColor = themeColors?.primary || "var(--wikios-accent, #3b82f6)";
  const secondaryColor = themeColors?.secondary || "var(--wikios-accent-hover, #60a5fa)";

  // Compute vertical positions of anchors in the content container
  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = contentRef.current;
    if (!container) return;

    const calculatedPins: GutterPinItem[] = [];
    const containerRect = container.getBoundingClientRect();

    // 1. Position pins for threads anchored to headings
    for (const thread of threads) {
      if (thread.status === "RESOLVED") continue;

      let targetEl: HTMLElement | null = null;
      if (thread.sectionAnchor) {
        targetEl = container.querySelector(
          `#${CSS.escape(thread.sectionAnchor)}, [data-section="${CSS.escape(thread.sectionAnchor)}"], h2, h3`
        ) as HTMLElement | null;
      }

      if (!targetEl) {
        targetEl = container.firstElementChild as HTMLElement | null;
      }

      if (targetEl) {
        const elRect = targetEl.getBoundingClientRect();
        const top = Math.max(0, elRect.top - containerRect.top + container.scrollTop);
        calculatedPins.push({
          id: thread.id,
          type: "thread",
          title: thread.title,
          sectionAnchor: thread.sectionAnchor,
          top,
        });
      }
    }

    // 2. Position pins for annotations (text highlights)
    for (const ann of annotations) {
      if (!ann.selectedText) continue;
      const snippet = ann.selectedText.slice(0, 30);
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent && node.textContent.includes(snippet)) {
          const parent = node.parentElement;
          if (parent) {
            const elRect = parent.getBoundingClientRect();
            const top = Math.max(0, elRect.top - containerRect.top + container.scrollTop);
            calculatedPins.push({
              id: ann.id,
              type: "annotation",
              title: ann.selectedText,
              color: ann.color || "#fbbf24",
              top,
            });
            break;
          }
        }
      }
    }

    // Sort by vertical position
    calculatedPins.sort((a, b) => a.top - b.top);

    // Group close pins
    const groupedPins: GutterPinItem[] = [];
    for (const pin of calculatedPins) {
      const last = groupedPins[groupedPins.length - 1];
      if (last && Math.abs(last.top - pin.top) < 32) {
        last.count = (last.count || 1) + 1;
      } else {
        groupedPins.push({ ...pin, count: 1 });
      }
    }

    setPins(groupedPins);
  }, [contentRef, threads, annotations]);

  const handlePinClick = (pin: GutterPinItem) => {
    soundEffects.press();
    if (pin.type === "annotation") {
      onSelectAnchor(null, pin.id, "markup");
    } else {
      onSelectAnchor(pin.sectionAnchor || null, pin.id, "threads");
    }
    onOpenDrawer();

    // Scroll to anchored element if present
    if (pin.sectionAnchor && contentRef.current) {
      const targetEl = contentRef.current.querySelector(
        `#${CSS.escape(pin.sectionAnchor)}`
      ) as HTMLElement | null;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handlePinMouseEnter = (pin: GutterPinItem) => {
    setHoveredPinId(pin.id);
    if (pin.sectionAnchor && contentRef.current) {
      const targetEl = contentRef.current.querySelector(
        `#${CSS.escape(pin.sectionAnchor)}`
      ) as HTMLElement | null;
      if (targetEl) {
        targetEl.classList.add("wikios-anchor-highlighted");
      }
    }
  };

  const handlePinMouseLeave = (pin: GutterPinItem) => {
    setHoveredPinId(null);
    if (contentRef.current) {
      contentRef.current
        .querySelectorAll(".wikios-anchor-highlighted")
        .forEach((el) => el.classList.remove("wikios-anchor-highlighted"));
    }
  };

  if (pins.length === 0) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-30 select-none">
      {pins.map((pin) => {
        const isHovered = hoveredPinId === pin.id;
        const isAnnotation = pin.type === "annotation";
        const pinBgColor = isAnnotation ? pin.color || "#fbbf24" : primaryColor;

        return (
          <div
            key={pin.id}
            style={{ top: `${pin.top}px` }}
            className="absolute right-1 -translate-y-1/2 flex items-center"
          >
            {/* Interactive Hover Tooltip Pill */}
            {isHovered && (
              <div className="absolute right-8 mr-1.5 px-2.5 py-1 rounded-xl bg-[var(--wikios-surface)]/95 border border-[var(--wikios-border)] shadow-xl text-xs text-[var(--wikios-text)] whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 z-50 flex items-center gap-1.5 backdrop-blur-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                  {isAnnotation ? "Highlight" : "Thread"}
                </span>
                <span className="opacity-40">·</span>
                <span className="truncate max-w-[160px] font-medium">{pin.title}</span>
              </div>
            )}

            <button
              type="button"
              style={{
                ...(isHovered
                  ? { backgroundColor: pinBgColor, borderColor: secondaryColor, color: "#ffffff" }
                  : isAnnotation
                  ? { borderColor: pinBgColor }
                  : {}),
              }}
              onClick={() => handlePinClick(pin)}
              onMouseEnter={() => handlePinMouseEnter(pin)}
              onMouseLeave={() => handlePinMouseLeave(pin)}
              className={cn(
                "pointer-events-auto flex items-center justify-center rounded-full border transition-all duration-200 cursor-pointer shadow-md active:scale-95 group",
                isHovered
                  ? "scale-110 z-40 shadow-lg text-white"
                  : isAnnotation
                  ? "border-amber-400/50 bg-[var(--wikios-surface)]/95 text-amber-400 hover:scale-105"
                  : "border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 text-[var(--wikios-accent)] hover:border-[var(--wikios-accent)] hover:bg-[var(--wikios-border)]",
                pin.count && pin.count > 1 ? "px-2 py-0.5 min-w-6 h-6" : "w-6 h-6"
              )}
              title={pin.title}
            >
              {isAnnotation ? (
                <Highlighter className="w-3 h-3 shrink-0" />
              ) : (
                <MessageSquare className="w-3 h-3 shrink-0" />
              )}
              {pin.count && pin.count > 1 && (
                <span className="ml-1 text-[10px] font-bold leading-none">{pin.count}</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
