import React from "react";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

/** The composer always has four steps: goal, approach, projected impact, review and declare. */
const STEP_COUNT = 4;

interface StepSectionProps {
  step: number;
  title: string;
  description?: React.ReactNode;
  /** Right-aligned header content (e.g. a "Change" button). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** One step of the directive composer: a pane headed by a gold step marker and its title. */
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
    <Card role="region" aria-labelledby={headingId} className={className}>
      <CardHeader className="flex-row items-start gap-3 p-4 sm:p-6">
        <span
          aria-hidden
          className="facet-gold text-footnote flex size-6 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums"
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-label text-headline">
            <span className="sr-only">
              Step {step} of {STEP_COUNT}:{" "}
            </span>
            {title}
          </h3>
          {description && <p className="text-label-secondary text-callout mt-1">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      {children && <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">{children}</CardContent>}
    </Card>
  );
}
