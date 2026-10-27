"use client";

import { forwardRef, type ReactNode } from "react";
import { Card, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils/cn";

interface StepCardProps {
  id: string;
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * One founding step: an input pane with the step's title as its h2. The heading takes focus when
 * the player moves to the step, so screen readers hear where they are.
 */
export const StepCard = forwardRef<HTMLDivElement, StepCardProps>(function StepCard(
  { id, icon, title, description, children },
  headingRef
) {
  return (
    <Card content="input" padding="lg" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <CardTitle
          ref={headingRef}
          id={`${id}-title`}
          role="heading"
          aria-level={2}
          tabIndex={-1}
          icon={icon}
          className="text-title-3 leading-tight outline-none"
        >
          {title}
        </CardTitle>
        {description && <p className="text-callout text-label-secondary">{description}</p>}
      </div>
      {children}
    </Card>
  );
});

interface FieldProps {
  id: string;
  label: string;
  /** "Required" in words, never a coloured dot. */
  required?: boolean;
  helper?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** A labelled field with its helper line, and its error in place of the helper once shown. */
export function Field({ id, label, required, helper, error, children, className }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id} className="text-subhead flex items-baseline gap-2">
        {label}
        {required && (
          <span className="text-footnote text-label-secondary font-normal">Required</span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-footnote text-destructive">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-footnote text-label-secondary">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

/** The `aria-describedby` and `aria-invalid` a field's control takes. */
export function fieldAria(id: string, error: string | undefined, helper: string | undefined) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : helper ? `${id}-helper` : undefined,
  } as const;
}
