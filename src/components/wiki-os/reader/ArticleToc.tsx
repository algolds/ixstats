"use client";

import { List } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";
import { cn } from "~/lib/utils";

/** Distance kept between the viewport top and a heading we scroll to (clears the shell header). */
const SCROLL_TOP_OFFSET = 90;

/** Header button that opens the table-of-contents drawer. Renders nothing for an article without headings. */
export function TocButton({ tocLength, onClick }: { tocLength: number; onClick?: () => void }) {
  if (tocLength <= 0 || !onClick) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={onClick}
      title="Table of contents"
      aria-label="Table of contents"
      className="border-separator bg-surface text-label-secondary hover:text-label rounded-control gap-2"
    >
      <List className="h-3.5 w-3.5" aria-hidden="true" />
      Contents
    </Button>
  );
}

interface TocDrawerProps {
  open: boolean;
  onClose: () => void;
  entries: TocEntry[];
}

function scrollToHeading(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_TOP_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
  window.history.replaceState(null, "", `#${id}`);
}

function indentClass(level: number): string {
  if (level <= 2) return "";
  return level === 3 ? "pl-6" : "pl-9";
}

/** Side sheet on desktop, bottom sheet on phones; lists the article's headings. */
export function TocDrawer({ open, onClose, entries }: TocDrawerProps) {
  // The reader's scroll spy keeps this in sync as the page scrolls.
  const { activeSectionId } = useWikiContext();

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-xs">
        <SheetHeader className="border-separator shrink-0 border-b px-6 py-5 pr-14">
          <SheetTitle className="text-headline">Table of contents</SheetTitle>
          <SheetDescription className="sr-only">Jump to a section of this article</SheetDescription>
        </SheetHeader>
        <nav aria-label="Table of contents" className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {entries.map((item) => {
            const isActive = activeSectionId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  scrollToHeading(item.id);
                  onClose();
                }}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "rounded-control text-callout duration-fast flex w-full cursor-pointer items-center border-l-2 px-3 py-2 text-left transition-colors",
                  isActive
                    ? "bg-fill-4 text-label border-tint font-medium"
                    : "text-label-secondary hover:bg-fill-4 hover:text-label border-transparent",
                  indentClass(item.level)
                )}
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
