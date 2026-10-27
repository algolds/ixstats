"use client";
// Renders margin gutter pin indicators precisely aligned with article text highlights and headings.
// Features debounced rAF layout batching, stable hitboxes, and frictionless hover physics.
import React, { useEffect, useState, useRef, useCallback } from "react";
import { ChatBubble as MessageSquare, DesignPencil as Highlighter } from "iconoir-react";
import { cn } from "~/lib/utils";

interface GutterPinItem {
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
  isMarginOpen?: boolean;
}

type PinChild = NonNullable<GutterPinItem["children"]>[number];
type RawPin = PinChild & { top: number };

const toChild = ({ id, type, title, comment, sectionAnchor, color }: PinChild): PinChild => ({
  id,
  type,
  title,
  comment,
  sectionAnchor,
  color,
});

/** First text node under `container` containing `snippet`, as its parent element. */
function findTextParent(container: HTMLElement, snippet: string): HTMLElement | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.includes(snippet) && node.parentElement) return node.parentElement;
  }
  return null;
}

/** Merge pins closer than 28px vertically into numbered clusters (input sorted by `top`). */
function clusterPins(rawPins: RawPin[]): GutterPinItem[] {
  const clustered: GutterPinItem[] = [];
  for (const pin of rawPins) {
    const last = clustered.at(-1);
    if (!last || Math.abs(last.top - pin.top) >= 28) {
      clustered.push({
        ...toChild(pin),
        top: pin.top,
        count: 1,
        threadCount: pin.type === "thread" ? 1 : 0,
        annotationCount: pin.type === "annotation" ? 1 : 0,
      });
      continue;
    }

    if (last.type !== "cluster") {
      const first = toChild(last as PinChild);
      Object.assign(last, {
        type: "cluster",
        children: [first],
        threadCount: first.type === "thread" ? 1 : 0,
        annotationCount: first.type === "annotation" ? 1 : 0,
      });
    }
    last.children?.push(toChild(pin));
    const countKey = pin.type === "thread" ? "threadCount" : "annotationCount";
    last[countKey] = (last[countKey] || 0) + 1;
    last.count = (last.count || 1) + 1;
  }
  return clustered;
}

export function MarginGutterPins({
  contentRef,
  threads,
  annotations,
  onSelectAnchor,
  onOpenDrawer,
  isMarginOpen = false,
}: MarginGutterPinsProps) {
  const [pins, setPins] = useState<GutterPinItem[]>([]);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const rafId = useRef<number | null>(null);
  const lastContainerHeight = useRef<number>(0);

  const computePins = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const rawPins: RawPin[] = [];
    const containerRect = container.getBoundingClientRect();
    lastContainerHeight.current = containerRect.height;
    const topOf = (el: HTMLElement, offset: number) =>
      Math.max(
        0,
        el.getBoundingClientRect().top - containerRect.top + container.scrollTop + offset
      );

    // Threads anchored to headings
    for (const thread of threads) {
      if (thread.status === "RESOLVED" || !thread.sectionAnchor) continue;
      const targetEl = container.querySelector<HTMLElement>(
        `#${CSS.escape(thread.sectionAnchor)}, [data-section="${CSS.escape(thread.sectionAnchor)}"]`
      );
      if (targetEl) {
        rawPins.push({
          id: thread.id,
          type: "thread",
          title: thread.title,
          sectionAnchor: thread.sectionAnchor,
          top: topOf(targetEl, 12),
        });
      }
    }

    // Annotations (text highlights): the rendered mark element, else the first text node matching a snippet
    for (const ann of annotations) {
      if (!ann.selectedText) continue;
      const markEl = container.querySelector<HTMLElement>(
        `mark[data-annotation-id="${CSS.escape(ann.id)}"], .wikios-annotation-mark[data-annotation-id="${CSS.escape(ann.id)}"]`
      );
      const anchorEl = markEl ?? findTextParent(container, ann.selectedText.slice(0, 30));
      if (!anchorEl) continue;

      rawPins.push({
        id: ann.id,
        type: "annotation",
        title: ann.comment ? `"${ann.comment}"` : ann.selectedText,
        comment: ann.comment,
        color: ann.color || "#fef036",
        top: markEl
          ? topOf(markEl, markEl.getBoundingClientRect().height / 2)
          : topOf(anchorEl, 10),
      });
    }

    rawPins.sort((a, b) => a.top - b.top);
    setPins(clusterPins(rawPins));
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
              <div className="animate-in fade-in zoom-in-95 rounded-row border-separator bg-surface text-footnote text-label shadow-floating pointer-events-none absolute right-0 bottom-full z-50 mb-2 flex max-w-xs origin-bottom-right flex-col gap-1 border px-3 py-2 whitespace-nowrap duration-150">
                {isCluster ? (
                  <>
                    <div className="border-separator text-caption text-label flex items-center gap-2 border-b pb-1 font-semibold">
                      <span className="py-0.2 bg-margin-accent rounded-control-sm text-caption px-2 font-semibold text-(--margin-badge-text)">
                        Cluster
                      </span>
                      <span>({pin.count} items)</span>
                      <span className="opacity-50">·</span>
                      <span>💬 {pin.threadCount || 0}</span>
                      <span>🖍️ {pin.annotationCount || 0}</span>
                    </div>
                    <div className="max-h-32 space-y-0.5 overflow-y-auto">
                      {pin.children?.slice(0, 3).map((c) => (
                        <div key={c.id} className="text-caption text-label-secondary truncate">
                          • {c.title}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="py-0.2 bg-margin-accent rounded-control-sm text-eyebrow px-2 text-(--margin-badge-text)">
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
                  "bg-margin-accent border-yellow/60 shadow-card flex cursor-pointer items-center justify-center rounded-full border font-semibold text-(--margin-badge-text) transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150",
                  isHovered
                    ? "border-yellow/50 z-40 scale-110"
                    : isCluster
                      ? "h-6 min-w-7 px-2 py-0.5"
                      : "h-6 w-6"
                )}
              >
                {isCluster ? (
                  <div className="text-caption flex items-center gap-0.5 font-semibold">
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
