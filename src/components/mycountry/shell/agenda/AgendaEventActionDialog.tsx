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
  ArrowUpRight,
  Compass,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
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
  return (
    <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && onClose()}>
      {selectedEvent && (
        <DialogContent className="border-border/80 bg-card/95 max-w-md space-y-4 rounded-2xl p-6 shadow-2xl backdrop-blur-2xl dark:border-white/15">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase",
                  selectedEvent.badgeCls
                )}
              >
                {selectedEvent.statusLabel}
              </span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {selectedEvent.timeLabel}
              </span>
            </div>
            <DialogTitle className="text-foreground text-base font-semibold tracking-tight">
              {selectedEvent.title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
              {selectedEvent.description}
            </DialogDescription>
          </DialogHeader>

          {/* Directive Goal Resolution Preview Box */}
          <div className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 shadow-inner">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
              <Command className="h-3.5 w-3.5" />
              <span>Recommended Resolution Directive</span>
            </div>
            <p className="text-foreground text-xs leading-snug font-semibold">
              &ldquo;{selectedEvent.directiveGoal}&rdquo;
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                soundEffects.bloom();
                const goal = selectedEvent.directiveGoal;
                onClose();
                onIssueDirective?.(goal);
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2.5 text-xs font-extrabold text-amber-900 shadow-md transition-all hover:bg-amber-500/30 active:scale-95 dark:text-amber-300"
            >
              <Command className="h-4 w-4" />
              <span>Declare Directive to Resolve</span>
              <ArrowUpRight className="h-4 w-4 opacity-70" />
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
                className="border-border/70 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition-all active:scale-98 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Compass className="h-3.5 w-3.5" />
                <span>
                  {selectedEvent.drillKind.kind === "issue"
                    ? "Open Issue Brief"
                    : "Inspect Domain Details"}
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
                className="border-border/70 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition-all active:scale-98 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Inspect Directive Tree</span>
              </button>
            ) : null}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
