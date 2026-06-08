// src/components/wikios/reader/AppleBooksTocDrawer.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { TocEntry } from "~/lib/wikios/html-transformer";
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
            className="fixed right-0 top-0 bottom-0 z-[100021] w-80 max-w-[85vw] bg-zinc-950/95 dark:bg-black/90 border-l border-white/10 shadow-2xl backdrop-blur-3xl flex flex-col h-full text-foreground"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
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
                <h3 className="text-sm font-bold tracking-wider uppercase text-foreground">
                  Table of Contents
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer active:scale-90"
                aria-label="Close Table of Contents"
              >
                <X size={16} />
              </button>
            </div>

            {/* List Entries */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 select-none scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {entries.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={cn(
                      "w-full text-left flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer select-none",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                      item.level === 3 ? "pl-6" : item.level > 3 ? "pl-9" : ""
                    )}
                    style={
                      isActive
                        ? {
                            borderLeft: `2.5px solid ${themeColors.primary}`,
                            paddingLeft: item.level === 3 ? "21.5px" : item.level > 3 ? "33.5px" : "9.5px",
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
