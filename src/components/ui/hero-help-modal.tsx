"use client";

import { useState } from "react";
import {
  HelpCircle,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  Xmark as X,
} from "iconoir-react";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface HeroHelpStep {
  title: string;
  body: string;
}

interface HeroHelpModalProps {
  /** Heading shown above the steps, e.g. "Dashboard guide". */
  title: string;
  steps: HeroHelpStep[];
  /** Tailwind text-color class for the accent (icon, dots, primary button). */
  accentClass?: string;
  /** Accessible label / tooltip for the trigger button. */
  triggerLabel?: string;
  className?: string;
}

/**
 * A reusable "?" help button that opens a short, re-openable stepped walkthrough.
 *
 * Unlike IntroDisclosure (which permanently hides itself once dismissed), this is
 * always reopenable — it's a help affordance, not a one-time onboarding gate.
 */
export function HeroHelpModal({
  title,
  steps,
  accentClass = "text-amber-500",
  triggerLabel = "Help & walkthrough",
  className,
}: HeroHelpModalProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setIndex(0); // always start at the beginning
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label={triggerLabel}
        title={triggerLabel}
        className={cn(
          "text-muted-foreground hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/10",
          className
        )}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="border-border/60 bg-background/95 max-w-md gap-0 overflow-hidden border p-0 shadow-2xl backdrop-blur-2xl"
        >
          <div className="border-border/40 flex items-center justify-between border-b bg-white/[0.02] px-5 py-3 dark:bg-black/[0.1]">
            <div className="flex items-center gap-2">
              <HelpCircle className={cn("h-4 w-4", accentClass)} />
              <span className="text-foreground text-sm font-semibold">{title}</span>
            </div>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-[140px] px-5 py-4">
            <h3 className="text-foreground text-base font-bold">{step?.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step?.body}</p>
          </div>

          <div className="border-border/40 flex items-center justify-between border-t bg-white/[0.01] px-5 py-3 dark:bg-black/[0.05]">
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? cn("w-4 bg-current", accentClass) : "bg-muted-foreground/30 w-1.5"
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={isFirst}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back
              </Button>
              {isLast ? (
                <Button size="sm" className="h-8 text-xs" onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
                >
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
