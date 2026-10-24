"use client";

import { useState } from "react";
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
import { SegmentedControl } from "~/components/ui/segmented-control";
import { LorewardsView } from "~/components/lorewards/LorewardsView";
import type { PassportWiki } from "../types";

interface PassportLorewardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The holder's Lorewards over the claimed names this viewer sees; null when there are none to show. */
  lorewards: PassportWiki["lorewards"];
}

/** The Lorewards of one of the holder's claimed names, picked above the view when there are several. */
export function PassportLorewardsModal({
  open,
  onOpenChange,
  lorewards,
}: PassportLorewardsModalProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const names = lorewards?.names ?? [];
  const authorName = picked && names.includes(picked) ? picked : names[0];
  if (!authorName) return null;

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
                <strong className="text-label font-medium">User:{authorName}</strong>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          {names.length > 1 && (
            <SegmentedControl
              aria-label="Wiki name"
              size="sm"
              value={authorName}
              onValueChange={setPicked}
              options={names.map((name) => ({ value: name, label: name }))}
            />
          )}
          <LorewardsView focus="you" username={authorName} />
        </div>

        <SheetFooter className="border-separator items-center border-t p-6 pt-4 sm:justify-between">
          <Link
            href={`/util/contributions/${encodeURIComponent(authorName)}`}
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
