/**
 * Atomic Selector Dialogs (Plan 166)
 *
 * Domain-agnostic dialog shells for:
 * - Interactions (Synergies & Conflicts)
 * - Selected Components List
 * - Metric Breakdowns (Effectiveness, Costs)
 */

"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";

export interface AtomicSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AtomicSelectorModal({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  iconClassName,
  children,
  footer,
  className,
}: AtomicSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-2xl max-h-[85vh] flex flex-col p-0", className)}>
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10",
                  iconClassName
                )}
              >
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
              {description && (
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">{children}</div>
        </ScrollArea>

        {footer && <div className="p-4 border-t border-border/50 bg-muted/20">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
