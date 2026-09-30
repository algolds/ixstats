import React from "react";
import { cn } from "~/lib/utils";

export interface StepSectionProps {
  step: number;
  title: string;
  description?: React.ReactNode;
  /** Right-aligned header content (e.g. a "Change" button). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** One numbered step of the directive composer: a grouped card with a plain header. */
export function StepSection({
  step,
  title,
  description,
  action,
  children,
  className,
}: StepSectionProps) {
  const headingId = `directive-step-${step}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("border-border bg-card rounded-2xl border p-4 sm:p-6", className)}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-foreground text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-foreground text-base leading-6 font-semibold">
            {title}
          </h3>
          {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}
