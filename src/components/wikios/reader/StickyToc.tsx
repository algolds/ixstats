// src/components/wikios/reader/StickyToc.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import type { TocEntry } from "~/lib/wikios/html-transformer";

interface StickyTocProps {
  entries: TocEntry[];
  contentRef: React.RefObject<HTMLElement | null>;
}

export function StickyToc({ entries }: StickyTocProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const visibleEntries = useMemo(
    () => entries.filter((e) => e.level <= 3),
    [entries]
  );

  // Scroll spy — vanilla DOM, runs once after mount
  useEffect(() => {
    function tick() {
      const ids = entries.map((e) => e.id);
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 100) {
          current = id;
        }
      }
      setActiveId(current);
    }

    window.addEventListener("scroll", tick, { passive: true });
    return () => window.removeEventListener("scroll", tick);
  }, [entries]);

  if (entries.length <= 3) return null;

  if (collapsed) {
    return (
      <div className="wikios-sticky-toc wikios-sticky-toc--collapsed">
        <button onClick={() => setCollapsed(false)} className="wikios-sticky-toc-toggle" type="button">
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <nav className="wikios-sticky-toc">
      <div className="wikios-sticky-toc-header">
        <span>On this page</span>
        <button onClick={() => setCollapsed(true)} className="wikios-sticky-toc-toggle" type="button">
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="wikios-sticky-toc-list">
        <div className="wikios-sticky-toc-track" />
        {visibleEntries.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`wikios-sticky-toc-item${activeId === item.id ? " wikios-sticky-toc-item--active" : ""}`}
            style={{ paddingLeft: `${(item.level - 2) * 12 + 12}px` }}
          >
            <span className="wikios-sticky-toc-text">{item.text}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
