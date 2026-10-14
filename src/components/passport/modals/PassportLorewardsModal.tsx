"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Trophy, OpenBook as BookOpen } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { LorewardsView } from "~/components/lorewards/LorewardsView";
import type { PassportWiki } from "../types";

interface PassportLorewardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wiki?: PassportWiki;
  handle: string;
}

export function PassportLorewardsModal({
  open,
  onOpenChange,
  wiki,
  handle,
}: PassportLorewardsModalProps) {
  const wikiUsername = wiki?.username || handle;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* A wide side sheet for the two-column calendar and ledger. */}
      <SheetContent size="wide" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-separator border-b p-6 pr-14 pb-4">
          <div className="flex items-center gap-3">
            <Trophy aria-hidden className="text-tint size-6 shrink-0" />
            <div>
              <SheetTitle>Lorewards accolades</SheetTitle>
              <SheetDescription className="mt-0.5">
                Author identity:{" "}
                <strong className="text-label font-medium">User:{wikiUsername}</strong>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <LorewardsView focus="you" username={wikiUsername} />
        </div>

        <SheetFooter className="border-separator items-center border-t p-6 pt-4 sm:justify-between">
          <Link
            href={`/util/contributions/${encodeURIComponent(wikiUsername)}`}
            className="text-tint text-footnote inline-flex cursor-pointer items-center gap-2 font-medium hover:underline"
          >
            <BookOpen aria-hidden className="size-3.5" />
            <span>View wiki contributions</span>
          </Link>

          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
