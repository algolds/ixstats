// src/components/wikios/reader/FloatingTocPill.tsx
// Floating TOC pill that appears when scrolling past the article title.
// Shows current section name, expands into a dropdown on click.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TocEntry } from "~/lib/wikios/html-transformer";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";

interface FloatingTocPillProps {
  entries: TocEntry[];
  /** Ref to the article title element — pill appears when this scrolls out of view */
  titleRef: React.RefObject<HTMLElement | null>;
}

export function FloatingTocPill({ entries, titleRef }: FloatingTocPillProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { setActiveSectionId } = useWikiContext();

  // Track which section is active via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (intersections) => {
        for (const entry of intersections) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            setActiveSectionId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    for (const item of entries) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [entries, setActiveSectionId]);

  // Show pill when article title scrolls out of view
  useEffect(() => {
    const titleEl = titleRef.current;
    if (!titleEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(titleEl);
    return () => observer.disconnect();
  }, [titleRef]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleNavigate = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    }
    setOpen(false);
  }, []);

  const activeEntry = entries.find((e) => e.id === activeId);
  const activeLabel = activeEntry?.text ?? entries[0]?.text ?? "Contents";

  if (entries.length <= 3) return null;

  return (
    <div
      ref={dropdownRef}
      className={`wikios-toc-pill ${visible ? "wikios-toc-pill--visible" : ""}`}
    >
      {/* Pill button */}
      <button
        className="wikios-toc-pill-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Table of contents"
      >
        <svg
          className="wikios-toc-pill-icon"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4h12M2 8h8M2 12h10" />
        </svg>
        <span className="wikios-toc-pill-label">{activeLabel}</span>
        <svg
          className={`wikios-toc-pill-chevron ${open ? "wikios-toc-pill-chevron--open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="wikios-toc-dropdown glass-hierarchy-child">
          <div className="wikios-toc-dropdown-inner">
            {entries.map((item) => (
              <button
                key={item.id}
                className={`wikios-toc-dropdown-item ${
                  activeId === item.id ? "wikios-toc-dropdown-item--active" : ""
                } ${item.level > 2 ? "wikios-toc-dropdown-item--sub" : ""}`}
                onClick={() => handleNavigate(item.id)}
              >
                {item.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
