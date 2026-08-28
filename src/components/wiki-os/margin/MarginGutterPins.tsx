"use client";
// src/components/wiki-os/margin/MarginGutterPins.tsx
// Renders margin gutter pin indicators precisely aligned with article text highlights and headings.
// Features debounced rAF layout batching, stable hitboxes, and frictionless hover physics.
// Apple Design & WikiOS Standard.

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ChatBubble as MessageSquare, DesignPencil as Highlighter } from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

export interface GutterPinItem {
  id: string;
  type: "thread" | "annotation" | "cluster";
  title: string;
  comment?: string | null;
  sectionAnchor?: string | null;
  count?: number;
  threadCount?: number;
  annotationCount?: number;
  color?: string;
  top: number;
  children?: Array<{
    id: string;
    type: "thread" | "annotation";
    title: string;
    comment?: string | null;
    sectionAnchor?: string | null;
    color?: string;
  }>;
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
    comment?: string | null;
    color: string;
  }>;
  onSelectAnchor: (anchor: string | null, threadId?: string, tab?: "threads" | "markup") => void;
  onOpenDrawer: () => void;
  themeColors?: ThemeColors | null;
  isMarginOpen?: boolean;
}

export function MarginGutterPins({
  contentRef,
  threads,
  annotations,
  onSelectAnchor,
  onOpenDrawer,
  themeColors,
  isMarginOpen = false,
}: MarginGutterPinsProps) {
  const [pins, setPins] = useState<GutterPinItem[]>([]);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const rafId = useRef<number | null>(null);
  const lastContainerHeight = useRef<number>(0);

  const primaryColor = themeColors?.primary || "var(--wikios-accent, #fef036)";
  // oxlint-disable-next-line eslint/no-unused-vars
  const secondaryColor = themeColors?.secondary || "var(--wikios-accent-hover, #facc15)";

  const computePins = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const rawPins: Array<{
      id: string;
      type: "thread" | "annotation";
      title: string;
      comment?: string | null;
      sectionAnchor?: string | null;
      color?: string;
      top: number;
    }> = [];

    const containerRect = container.getBoundingClientRect();
    lastContainerHeight.current = containerRect.height;

    // 1. Position pins for threads anchored to headings
    for (const thread of threads) {
      if (thread.status === "RESOLVED") continue;

      let targetEl: HTMLElement | null = null;
      if (thread.sectionAnchor) {
        targetEl = container.querySelector(
          `#${CSS.escape(thread.sectionAnchor)}, [data-section="${CSS.escape(thread.sectionAnchor)}"]`
        ) as HTMLElement | null;
      }

      if (targetEl) {
        const elRect = targetEl.getBoundingClientRect();
        const top = Math.max(0, elRect.top - containerRect.top + container.scrollTop + 12);
        rawPins.push({
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

      // First check for direct DOM mark element
      const markEl = container.querySelector(
        `mark[data-annotation-id="${CSS.escape(ann.id)}"], .wikios-annotation-mark[data-annotation-id="${CSS.escape(ann.id)}"]`
      ) as HTMLElement | null;

      if (markEl) {
        const elRect = markEl.getBoundingClientRect();
        const top = Math.max(
          0,
          elRect.top - containerRect.top + container.scrollTop + elRect.height / 2
        );
        rawPins.push({
          id: ann.id,
          type: "annotation",
          title: ann.comment ? `"${ann.comment}"` : ann.selectedText,
          comment: ann.comment,
          color: ann.color || "#fef036",
          top,
        });
        continue;
      }

      // Fallback TreeWalker matching
      const snippet = ann.selectedText.slice(0, 30);
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent && node.textContent.includes(snippet)) {
          const parent = node.parentElement;
          if (parent) {
            const elRect = parent.getBoundingClientRect();
            const top = Math.max(0, elRect.top - containerRect.top + container.scrollTop + 10);
            rawPins.push({
              id: ann.id,
              type: "annotation",
              title: ann.comment ? `"${ann.comment}"` : ann.selectedText,
              comment: ann.comment,
              color: ann.color || "#fef036",
              top,
            });
            break;
          }
        }
      }
    }

    // Sort by vertical coordinate
    rawPins.sort((a, b) => a.top - b.top);

    // Multi-Pin Cluster Collision Resolution (< 28px distance)
    const clustered: GutterPinItem[] = [];
    for (const pin of rawPins) {
      const last = clustered[clustered.length - 1];
      if (last && Math.abs(last.top - pin.top) < 28) {
        if (last.type !== "cluster") {
          const initialChild = {
            id: last.id,
            type: last.type as "thread" | "annotation",
            title: last.title,
            comment: last.comment,
            sectionAnchor: last.sectionAnchor,
            color: last.color,
          };
          last.type = "cluster";
          last.children = [initialChild];
          last.threadCount = initialChild.type === "thread" ? 1 : 0;
          last.annotationCount = initialChild.type === "annotation" ? 1 : 0;
        }

        last.children?.push({
          id: pin.id,
          type: pin.type,
          title: pin.title,
          comment: pin.comment,
          sectionAnchor: pin.sectionAnchor,
          color: pin.color,
        });

        if (pin.type === "thread") {
          last.threadCount = (last.threadCount || 0) + 1;
        } else {
          last.annotationCount = (last.annotationCount || 0) + 1;
        }

        last.count = (last.count || 1) + 1;
      } else {
        clustered.push({
          id: pin.id,
          type: pin.type,
          title: pin.title,
          comment: pin.comment,
          sectionAnchor: pin.sectionAnchor,
          color: pin.color,
          top: pin.top,
          count: 1,
          threadCount: pin.type === "thread" ? 1 : 0,
          annotationCount: pin.type === "annotation" ? 1 : 0,
        });
      }
    }

    setPins(clustered);
  }, [contentRef, threads, annotations]);

  // Re-compute pins on mount, resize, and layout changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const scheduleCompute = () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(computePins);
    };

    scheduleCompute();

    const container = contentRef.current;
    let resizeObserver: ResizeObserver | null = null;

    if (container && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height;
          // Avoid re-calculating on micro-shifts < 4px to prevent hover thrashing
          if (Math.abs(height - lastContainerHeight.current) > 4) {
            scheduleCompute();
          }
        }
      });
      resizeObserver.observe(container);
    }

    window.addEventListener("resize", scheduleCompute, { passive: true });

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleCompute);
    };
  }, [computePins, contentRef]);

  // Clean up any lingering anchor highlights on unmount
  useEffect(() => {
    return () => {
      // oxlint-disable-next-line
      if (contentRef.current) {
        // oxlint-disable-next-line
        contentRef.current
          .querySelectorAll(".wikios-anchor-highlighted")
          .forEach((el) => el.classList.remove("wikios-anchor-highlighted"));
      }
    };
  }, [contentRef]);

  const handlePinClick = (pin: GutterPinItem) => {
    soundEffects.press();
    if (pin.type === "annotation") {
      onSelectAnchor(null, pin.id, "markup");
    } else if (pin.type === "thread") {
      onSelectAnchor(pin.sectionAnchor || null, pin.id, "threads");
    } else if (pin.type === "cluster" && pin.children && pin.children.length > 0) {
      const first = pin.children[0]!;
      onSelectAnchor(
        first.sectionAnchor || null,
        first.id,
        first.type === "thread" ? "threads" : "markup"
      );
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
    if (!contentRef.current) return;

    if (pin.type === "annotation") {
      const markEl = contentRef.current.querySelector(
        `mark[data-annotation-id="${CSS.escape(pin.id)}"], .wikios-annotation-mark[data-annotation-id="${CSS.escape(pin.id)}"]`
      ) as HTMLElement | null;
      if (markEl) markEl.classList.add("wikios-anchor-highlighted");
    } else if (pin.type === "cluster" && pin.children) {
      for (const child of pin.children) {
        if (child.type === "annotation") {
          const markEl = contentRef.current.querySelector(
            `mark[data-annotation-id="${CSS.escape(child.id)}"], .wikios-annotation-mark[data-annotation-id="${CSS.escape(child.id)}"]`
          ) as HTMLElement | null;
          if (markEl) markEl.classList.add("wikios-anchor-highlighted");
        } else if (child.sectionAnchor) {
          const targetEl = contentRef.current.querySelector(
            `#${CSS.escape(child.sectionAnchor)}`
          ) as HTMLElement | null;
          if (targetEl) targetEl.classList.add("wikios-anchor-highlighted");
        }
      }
    } else if (pin.sectionAnchor) {
      const targetEl = contentRef.current.querySelector(
        `#${CSS.escape(pin.sectionAnchor)}`
      ) as HTMLElement | null;
      if (targetEl) targetEl.classList.add("wikios-anchor-highlighted");
    }
  };

  const handlePinMouseLeave = (_pin: GutterPinItem) => {
    setHoveredPinId(null);
    if (contentRef.current) {
      contentRef.current
        .querySelectorAll(".wikios-anchor-highlighted")
        .forEach((el) => el.classList.remove("wikios-anchor-highlighted"));
    }
  };

  if (pins.length === 0 || isMarginOpen) return null;

  return (
    <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 hidden select-none md:block">
      {pins.map((pin) => {
        const isHovered = hoveredPinId === pin.id;
        const isCluster = pin.type === "cluster";
        const isAnnotation = pin.type === "annotation";
        // oxlint-disable-next-line eslint/no-unused-vars
        const pinBgColor = isAnnotation ? pin.color || "#fef036" : primaryColor;
        const hasFlyout = isCluster || pin.type === "thread" || !!pin.comment;

        return (
          <div
            key={pin.id}
            style={{ top: `${pin.top}px` }}
            className="group/gutter absolute right-[-14px] flex -translate-y-1/2 items-center lg:right-[-20px]"
            onMouseEnter={() => handlePinMouseEnter(pin)}
            onMouseLeave={() => handlePinMouseLeave(pin)}
          >
            {/* Elevated Flyout Tooltip (Floats above pin to avoid blocking article text) */}
            {isHovered && hasFlyout && (
              <div className="animate-in fade-in zoom-in-95 pointer-events-none absolute right-0 bottom-full z-50 mb-2 flex max-w-xs origin-bottom-right flex-col gap-1 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 px-3 py-1.5 text-xs whitespace-nowrap text-[var(--wikios-text)] shadow-2xl backdrop-blur-xl duration-150">
                {isCluster ? (
                  <>
                    <div className="flex items-center gap-2 border-b border-[var(--wikios-border)] pb-1 text-[10px] font-bold text-[var(--wikios-text)]">
                      <span className="py-0.2 bg-margin-accent rounded px-1.5 text-[9px] font-bold text-stone-950">
                        Cluster
                      </span>
                      <span>({pin.count} items)</span>
                      <span className="opacity-50">·</span>
                      <span>💬 {pin.threadCount || 0}</span>
                      <span>🖍️ {pin.annotationCount || 0}</span>
                    </div>
                    <div className="max-h-32 space-y-0.5 overflow-y-auto">
                      {pin.children?.slice(0, 3).map((c) => (
                        <div
                          key={c.id}
                          className="truncate text-[10.5px] font-medium text-[var(--wikios-text-dim)]"
                        >
                          • {c.title}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="py-0.2 bg-margin-accent rounded px-1.5 text-[9px] font-black tracking-wider text-stone-950 uppercase">
                      {isAnnotation ? "Note" : "Thread"}
                    </span>
                    <span className="opacity-40">·</span>
                    <span className="max-w-[190px] truncate font-medium">{pin.title}</span>
                  </div>
                )}
              </div>
            )}

            {/* Stable Hitbox Container */}
            <div className="pointer-events-auto flex h-8 w-8 items-center justify-center">
              <button
                type="button"
                onClick={() => handlePinClick(pin)}
                aria-label={pin.title}
                className={cn(
                  "bg-margin-accent flex cursor-pointer items-center justify-center rounded-full border border-yellow-400/60 font-bold text-stone-950 shadow-md backdrop-blur-md transition-all duration-150 active:scale-95",
                  isHovered
                    ? "z-40 scale-110 border-yellow-400 shadow-[0_0_14px_rgba(254,240,54,0.5)]"
                    : isCluster
                      ? "h-6 min-w-7 px-2 py-0.5 hover:scale-105"
                      : "h-6 w-6 hover:scale-105"
                )}
              >
                {isCluster ? (
                  <div className="flex items-center gap-0.5 text-[9.5px] font-black">
                    <span>💬{pin.threadCount}</span>
                    {pin.annotationCount ? <span>🖍️{pin.annotationCount}</span> : null}
                  </div>
                ) : isAnnotation ? (
                  <Highlighter className="h-3 w-3 shrink-0 stroke-[2.5]" />
                ) : (
                  <MessageSquare className="h-3 w-3 shrink-0 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
