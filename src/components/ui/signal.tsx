"use client";

import * as React from "react";
import { InfoCircle, CheckCircle, WarningTriangle, WarningCircle, Xmark } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { Button } from "~/components/ui/button";

type SignalTone = "info" | "success" | "warning" | "destructive";

const TONE: Record<SignalTone, { icon: React.ElementType; ink: string; accent: string }> = {
  info: { icon: InfoCircle, ink: "text-info-ink", accent: "var(--color-info)" },
  success: { icon: CheckCircle, ink: "text-success-ink", accent: "var(--color-success)" },
  warning: { icon: WarningTriangle, ink: "text-warning-ink", accent: "var(--color-warning)" },
  destructive: { icon: WarningCircle, ink: "text-destructive-ink", accent: "var(--color-destructive)" },
};

interface SignalProps {
  tone: SignalTone;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Omit for critical signals that must stay visible. */
  onDismiss?: () => void;
  className?: string;
}

/** A persistent inline status for a section: an alert, a crisis, a notice. At most one per section. */
export function Signal({ tone, title, children, onDismiss, className }: SignalProps) {
  const { icon: Icon, ink, accent } = TONE[tone];
  return (
    <div
      role={tone === "destructive" ? "alert" : "status"}
      data-content="signal"
      style={{ "--facet-accent": accent } as React.CSSProperties}
      className={cn("facet-pane rounded-card flex items-start gap-3 p-4", className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", ink)} />
      <div className="min-w-0 flex-1">
        <p className="text-headline text-label">{title}</p>
        {children != null && <p className="text-callout text-label-secondary mt-1">{children}</p>}
      </div>
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 shrink-0"
        >
          <Xmark aria-hidden className="size-4" />
        </Button>
      )}
    </div>
  );
}
