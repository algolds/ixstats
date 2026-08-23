// src/components/wiki-os/reader/AppleBooksTocDrawer.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Xmark as X } from "iconoir-react";
import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";
import { cn } from "~/lib/utils";

interface AppleBooksTocDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: TocEntry[];
  themeColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export function AppleBooksTocDrawer({
  isOpen,
  onClose,
  entries,
  themeColors,
}: AppleBooksTocDrawerProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll spy to highlight the active section as the user scrolls
  useEffect(() => {
    if (!isOpen) return;

    function tick() {
      const ids = entries.map((e) => e.id);
      let current: string | null = null;
      // Find the first heading that is currently above or near the top of the viewport
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) {
            current = id;
          }
        }
      }
      setActiveId(current);
    }

    window.addEventListener("scroll", tick, { passive: true });
    tick(); // Run immediately on open

    return () => window.removeEventListener("scroll", tick);
  }, [entries, isOpen]);

  // Lock body scrolling when the drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleNavigate = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90; // Header offset
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      window.history.replaceState(null, "", `#${id}`);
    }
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100020] bg-black/40 backdrop-blur-[2px] transition-opacity"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="text-foreground fixed top-0 right-0 bottom-0 z-[100021] flex h-full w-80 max-w-[85vw] flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-3xl dark:bg-black/90"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-2">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-muted-foreground"
                >
                  <path d="M2 4h12M2 8h8M2 12h10" />
                </svg>
                <h3 className="text-foreground text-sm font-bold tracking-wider uppercase">
                  Table of Contents
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-full p-1.5 transition-all duration-200 hover:bg-white/10 active:scale-90"
                aria-label="Close Table of Contents"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List Entries */}
            <div className="flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-1 overflow-y-auto px-4 py-4 select-none">
              {entries.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all duration-200 select-none",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                      item.level === 3 ? "pl-6" : item.level > 3 ? "pl-9" : ""
                    )}
                    style={
                      isActive
                        ? {
                            borderLeft: `2.5px solid ${themeColors.primary}`,
                            paddingLeft:
                              item.level === 3 ? "21.5px" : item.level > 3 ? "33.5px" : "9.5px",
                          }
                        : {}
                    }
                  >
                    <span className="truncate">{item.text}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
