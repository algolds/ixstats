"use client";

import { useState } from "react";
import { Reply } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { BottomDock, DockSpacer } from "../shell";
import { CanvasComposer, type CanvasComposerProps } from "./CanvasComposer";
import { REPLY_ID } from "./constants";
import { useMyPersonas } from "./PersonaSelect";

interface ReplyComposerProps extends Pick<
  CanvasComposerProps,
  "threadId" | "onSubmit" | "quoteRequest" | "onQuoteInserted" | "postStyle"
> {
  /** The thread's board takes in-character posts: the persona switcher is offered. */
  icAllowed: boolean;
  phone: boolean;
  /** Phone only: whether the sheet is open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A thread's reply composer. Wide screens show it under the posts; phones get a docked "Reply" bar above the tab bar
 * that opens it in a full-height sheet, keeping the draft while the sheet is closed.
 */
export function ReplyComposer({
  icAllowed,
  phone,
  open,
  onOpenChange,
  onSubmit,
  ...composer
}: ReplyComposerProps) {
  const personas = useMyPersonas(icAllowed);
  const [draft, setDraft] = useState("");

  if (!phone) {
    return (
      <section id={REPLY_ID} aria-label="Reply" className="scroll-mt-24 space-y-2">
        <CanvasComposer mode="reply" personas={personas} onSubmit={onSubmit} {...composer} />
      </section>
    );
  }

  return (
    <>
      {/* Keeps the last post clear of the docked bar. */}
      <DockSpacer />
      <BottomDock docked slot="reply-dock">
        <Button
          type="button"
          className="w-full pointer-coarse:min-h-11"
          onClick={() => onOpenChange(true)}
        >
          <Reply aria-hidden />
          Reply
        </Button>
      </BottomDock>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" detents={["large"]} aria-describedby={undefined}>
          <SheetTitle className="text-headline mb-3">Reply</SheetTitle>
          <CanvasComposer
            mode="reply"
            fill
            personas={personas}
            initialWikitext={draft}
            onWikitextChange={setDraft}
            onSubmit={async (wikitext, meta) => {
              const result = await onSubmit(wikitext, meta);
              // A save that is still formatting keeps the sheet open to say so.
              if (result.formatting === "done") onOpenChange(false);
              return result;
            }}
            {...composer}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
