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
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetContainer } from "~/components/ui/facet-container";
import { STATUS_TEXT } from "../status-tone";
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
            <p className="flex items-center gap-2 text-xs">
              <selectedEvent.icon
                aria-hidden="true"
                className={cn("size-4 shrink-0", STATUS_TEXT[selectedEvent.tone])}
              />
              <span className={cn("font-semibold", STATUS_TEXT[selectedEvent.tone])}>
                {selectedEvent.statusLabel}
              </span>
              <span className="text-muted-foreground tabular-nums">
                · {selectedEvent.timeLabel}
              </span>
            </p>
            <DialogTitle className="text-foreground text-lg leading-snug font-semibold tracking-tight">
              {selectedEvent.title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
              {selectedEvent.description}
            </DialogDescription>
          </DialogHeader>

          {/* Suggested directive: an opaque panel inside the dialog's glass (no stacked blur) */}
          <FacetContainer depth={3} surface="solid" className="space-y-1 rounded-2xl p-4">
            <Eyebrow className="flex items-center gap-1.5">
              <Command aria-hidden="true" className="size-3.5" />
              Suggested directive
            </Eyebrow>
            <p className="text-foreground text-sm leading-snug">
              &ldquo;{selectedEvent.directiveGoal}&rdquo;
            </p>
          </FacetContainer>

          <div className={cn("flex flex-col gap-2", isIssue && "flex-col-reverse")}>
            <Button
              type="button"
              variant={isIssue ? "secondary" : "default"}
              data-cuelume-press="bloom"
              onClick={() => {
                const goal = selectedEvent.directiveGoal;
                onClose();
                onIssueDirective?.(goal);
              }}
              className="h-11 w-full sm:h-10"
            >
              <Command aria-hidden="true" />
              <span>Declare Directive</span>
            </Button>

            {selectedEvent.drillKind ? (
              <Button
                type="button"
                variant={isIssue ? "default" : "secondary"}
                onClick={() => {
                  const drill = selectedEvent.drillKind!;
                  onClose();
                  onOpenDrill?.(drill);
                }}
                className="h-11 w-full sm:h-10"
              >
                <Compass aria-hidden="true" />
                <span>
                  {selectedEvent.drillKind.kind === "issue" ? "Open issue brief" : "View details"}
                </span>
              </Button>
            ) : selectedEvent.intentId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const id = selectedEvent.intentId!;
                  onClose();
                  onOpenIntent?.(id);
                }}
                className="h-11 w-full sm:h-10"
              >
                <Compass aria-hidden="true" />
                <span>View directive</span>
              </Button>
            ) : null}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
