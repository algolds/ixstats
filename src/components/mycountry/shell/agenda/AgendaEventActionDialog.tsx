"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  KeyCommand as Command,
  Compass,
  Archive,
  Mail,
  Clock,
  MailIn,
  TriangleFlag,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetContainer } from "~/components/ui/facet-container";
import { STATUS_TEXT } from "../status-tone";
import type { AgendaItem, ExecutiveAgendaProps } from "./agendaTypes";
import { formatInboxTime } from "./deriveAgendaItems";
import { SNOOZE_DAY_MS, SNOOZE_WEEK_MS, type InboxPlacement } from "./inboxState";

interface AgendaEventActionDialogProps {
  selectedEvent: AgendaItem | null;
  /** Where the item currently lives; decides which inbox actions show. */
  placement?: InboxPlacement;
  nowMs?: number;
  onClose: () => void;
  onIssueDirective?: ExecutiveAgendaProps["onIssueDirective"];
  onOpenDrill?: ExecutiveAgendaProps["onOpenDrill"];
  onOpenIntent?: ExecutiveAgendaProps["onOpenIntent"];
  onMarkUnread?: (item: AgendaItem) => void;
  onMarkDone?: (item: AgendaItem) => void;
  onSnooze?: (item: AgendaItem, forMs: number) => void;
  onMoveToInbox?: (item: AgendaItem) => void;
}

/**
 * An opened inbox item: what it is, the suggested directive and the next step (issue brief,
 * directive, details), plus the inbox actions — mark unread, snooze for a day or a week, done —
 * or, for a snoozed or done item, move it back to the inbox.
 */
export function AgendaEventActionDialog({
  selectedEvent,
  placement = "inbox",
  nowMs = Date.now(),
  onClose,
  onIssueDirective,
  onOpenDrill,
  onOpenIntent,
  onMarkUnread,
  onMarkDone,
  onSnooze,
  onMoveToInbox,
}: AgendaEventActionDialogProps) {
  // For an issue the brief is the primary step; everything else leads with the directive.
  const isIssue = selectedEvent?.drillKind?.kind === "issue";
  const run = (fn: ((item: AgendaItem) => void) | undefined) => {
    if (!selectedEvent) return;
    const item = selectedEvent;
    onClose();
    fn?.(item);
  };
  const timeLabel = selectedEvent ? formatInboxTime(selectedEvent, nowMs) : "";

  return (
    <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && onClose()}>
      {selectedEvent && (
        <DialogContent className="max-w-md space-y-5 rounded-3xl p-6">
          <DialogHeader className="space-y-3 text-left">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <selectedEvent.icon
                aria-hidden="true"
                className={cn("size-4 shrink-0", STATUS_TEXT[selectedEvent.tone])}
              />
              <span className={cn("font-semibold", STATUS_TEXT[selectedEvent.tone])}>
                {selectedEvent.statusLabel}
              </span>
              {timeLabel ? (
                <span className="text-muted-foreground tabular-nums">· {timeLabel}</span>
              ) : null}
              {selectedEvent.flagged ? (
                <span className="text-destructive flex items-center gap-1 font-medium">
                  <TriangleFlag aria-hidden="true" className="size-3.5" />
                  Needs action
                </span>
              ) : null}
            </p>
            <DialogTitle className="text-foreground text-lg leading-snug font-semibold tracking-tight">
              {selectedEvent.title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
              {selectedEvent.description}
            </DialogDescription>
          </DialogHeader>

          {/* Suggested directive: an opaque panel inside the dialog (no stacked blur) */}
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
              onClick={() => run((item) => onIssueDirective?.(item.directiveGoal))}
              className="h-11 w-full sm:h-10"
            >
              <Command aria-hidden="true" />
              <span>Declare Directive</span>
            </Button>

            {selectedEvent.drillKind ? (
              <Button
                type="button"
                variant={isIssue ? "default" : "secondary"}
                onClick={() => run((item) => item.drillKind && onOpenDrill?.(item.drillKind))}
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
                onClick={() => run((item) => item.intentId && onOpenIntent?.(item.intentId))}
                className="h-11 w-full sm:h-10"
              >
                <Compass aria-hidden="true" />
                <span>View directive</span>
              </Button>
            ) : null}
          </div>

          {/* Inbox actions */}
          <div
            role="group"
            aria-label="Inbox actions"
            className="border-separator flex flex-wrap gap-1.5 border-t pt-4"
          >
            {placement === "inbox" ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => run(onMarkUnread)}>
                  <Mail aria-hidden="true" />
                  Mark as unread
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => run((item) => onSnooze?.(item, SNOOZE_DAY_MS))}
                >
                  <Clock aria-hidden="true" />
                  Snooze a day
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => run((item) => onSnooze?.(item, SNOOZE_WEEK_MS))}
                >
                  <Clock aria-hidden="true" />
                  Snooze a week
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => run(onMarkDone)}>
                  <Archive aria-hidden="true" />
                  Done
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => run(onMoveToInbox)}>
                <MailIn aria-hidden="true" />
                Move to inbox
              </Button>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
