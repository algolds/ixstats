"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { KeyCommand as Command, Compass } from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { IconTile, PRIMARY_BUTTON, SECONDARY_BUTTON, TONE } from "../surface-kit";
import type { AgendaEvent, ExecutiveAgendaProps } from "./agendaTypes";

interface AgendaEventActionDialogProps {
  selectedEvent: AgendaEvent | null;
  onClose: () => void;
  onIssueDirective?: ExecutiveAgendaProps["onIssueDirective"];
  onOpenDrill?: ExecutiveAgendaProps["onOpenDrill"];
  onOpenIntent?: ExecutiveAgendaProps["onOpenIntent"];
}

export function AgendaEventActionDialog({
  selectedEvent,
  onClose,
  onIssueDirective,
  onOpenDrill,
  onOpenIntent,
}: AgendaEventActionDialogProps) {
  // For an issue the brief is the primary step; everything else leads with the directive.
  const isIssue = selectedEvent?.drillKind?.kind === "issue";
  return (
    <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && onClose()}>
      {selectedEvent && (
        <DialogContent className="max-w-md space-y-5 rounded-3xl p-6">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <IconTile icon={selectedEvent.icon} tone={selectedEvent.tone} />
              <p className="text-xs">
                <span className={cn("font-semibold", TONE[selectedEvent.tone].text)}>
                  {selectedEvent.statusLabel}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {" "}
                  · {selectedEvent.timeLabel}
                </span>
              </p>
            </div>
            <DialogTitle className="text-foreground text-lg leading-snug font-semibold tracking-tight">
              {selectedEvent.title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
              {selectedEvent.description}
            </DialogDescription>
          </DialogHeader>

          {/* Suggested directive */}
          <div className="bg-muted/50 space-y-1 rounded-2xl p-4">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <Command aria-hidden="true" className="h-3.5 w-3.5" />
              Suggested directive
            </p>
            <p className="text-foreground text-sm leading-snug">
              &ldquo;{selectedEvent.directiveGoal}&rdquo;
            </p>
          </div>

          <div className={cn("flex flex-col gap-2", isIssue && "flex-col-reverse")}>
            <button
              type="button"
              onClick={() => {
                soundEffects.bloom();
                const goal = selectedEvent.directiveGoal;
                onClose();
                onIssueDirective?.(goal);
              }}
              className={cn(isIssue ? SECONDARY_BUTTON : PRIMARY_BUTTON, "w-full sm:h-10")}
            >
              <Command aria-hidden="true" className="h-4 w-4" />
              <span>Declare Directive</span>
            </button>

            {selectedEvent.drillKind ? (
              <button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  const drill = selectedEvent.drillKind!;
                  onClose();
                  onOpenDrill?.(drill);
                }}
                className={cn(isIssue ? PRIMARY_BUTTON : SECONDARY_BUTTON, "w-full sm:h-10")}
              >
                <Compass aria-hidden="true" className="h-4 w-4" />
                <span>
                  {selectedEvent.drillKind.kind === "issue" ? "Open issue brief" : "View details"}
                </span>
              </button>
            ) : selectedEvent.intentId ? (
              <button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  const id = selectedEvent.intentId!;
                  onClose();
                  onOpenIntent?.(id);
                }}
                className={cn(SECONDARY_BUTTON, "w-full sm:h-10")}
              >
                <Compass aria-hidden="true" className="h-4 w-4" />
                <span>View directive</span>
              </button>
            ) : null}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
