"use client";

import { useState } from "react";
import {
  HelpCircle,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  Xmark as X,
} from "iconoir-react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";

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
  accentClass = "text-tint",
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
          "text-label-secondary hover:text-label bg-fill-3 hover:bg-fill-2 border-separator duration-fast focus-visible:outline-tint inline-flex size-7 items-center justify-center rounded-full border transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2",
          className
        )}
      >
        <HelpCircle aria-hidden="true" className="size-4" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <div className="border-separator flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <HelpCircle aria-hidden="true" className={cn("size-4", accentClass)} />
              <DialogTitle className="text-headline text-label">{title}</DialogTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleOpenChange(false)}
              aria-label="Close"
              className="text-label-secondary hover:text-label"
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          <div className="min-h-[140px] px-5 py-4">
            <h3 className="text-title-3 text-label">{step?.title}</h3>
            <p className="text-callout text-label-secondary mt-2">{step?.body}</p>
          </div>

          <div className="border-separator bg-surface-secondary flex items-center justify-between border-t px-5 py-3">
            <div aria-hidden="true" className="flex items-center gap-2">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "duration-fast h-1.5 rounded-full transition-[width,background-color]",
                    i === index ? cn("w-4 bg-current", accentClass) : "bg-fill w-1.5"
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isFirst}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft aria-hidden="true" /> Back
              </Button>
              {isLast ? (
                <Button size="sm" onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
                >
                  Next <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
