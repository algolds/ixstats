"use client";
// src/components/wiki-os/reader/AppleBooksTocDrawer.tsx

import { useState, useEffect } from "react";
import { List } from "iconoir-react";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent aria-describedby={undefined} className="flex flex-col gap-0 p-0 sm:max-w-xs">
        {/* Header */}
        <div className="border-separator flex shrink-0 items-center gap-2 border-b px-6 py-5 pr-14">
          <List className="text-label-secondary size-4" aria-hidden="true" />
          <SheetTitle className="text-headline">Table of contents</SheetTitle>
        </div>

        {/* Entries */}
        <nav
          aria-label="Table of contents"
          className="flex-1 space-y-1 overflow-y-auto px-4 py-4 select-none"
        >
          {entries.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "rounded-control text-callout duration-fast flex w-full cursor-pointer items-center gap-2 border-l-2 px-3 py-2 text-left transition-colors",
                  isActive
                    ? "bg-fill-4 text-label font-medium"
                    : "text-label-secondary hover:bg-fill-4 hover:text-label border-transparent",
                  item.level === 3 ? "pl-6" : item.level > 3 ? "pl-9" : ""
                )}
                style={isActive ? { borderLeftColor: themeColors.primary } : undefined}
              >
                <span className="truncate">{item.text}</span>
              </button>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
