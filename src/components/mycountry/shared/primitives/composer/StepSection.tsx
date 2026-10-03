import React from "react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

/** The composer always has four steps: goal, approach, projected impact, review and declare. */
const STEP_COUNT = 4;

export interface StepSectionProps {
  step: number;
  title: string;
  description?: React.ReactNode;
  /** Right-aligned header content (e.g. a "Change" button). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * One step of the directive composer: a depth-2 Facet card (solid, since it sits inside the
 * Directives workspace's glass shell) with a "Step n of 4" eyebrow over a plain title.
 */
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
    <Card role="region" aria-labelledby={headingId} className={cn("rounded-card", className)}>
      <CardHeader className="flex-row items-start gap-3 p-4 sm:p-6">
        <div className="min-w-0 flex-1">
          <Eyebrow className="block">
            Step {step} of {STEP_COUNT}
          </Eyebrow>
          <h3 id={headingId} className="text-label text-title-3 mt-1 leading-6">
            {title}
          </h3>
          {description && <p className="text-label-secondary text-body mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      {children && <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">{children}</CardContent>}
    </Card>
  );
}
