import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils/cn";

type Status =
  | "operational"
  | "degraded"
  | "partial-outage"
  | "major-outage"
  | "maintenance"
  | "incident"
  | "unknown"
  | "developer"
  | "alpha"
  | "beta"
  | "rc"
  | "stable";

/** Status → system colour: a dot in the colour and the label in its `-ink` (AA on surfaces). */
const STATUS_CONFIG: Record<Status, { label: string; dot: string; text: string }> = {
  operational: {
    label: "Operational",
    dot: "bg-green",
    text: "text-green-ink",
  },
  degraded: {
    label: "Degraded",
    dot: "bg-yellow",
    text: "text-yellow-ink",
  },
  "partial-outage": {
    label: "Partial Outage",
    dot: "bg-orange",
    text: "text-orange-ink",
  },
  "major-outage": {
    label: "Major Outage",
    dot: "bg-red",
    text: "text-red-ink",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-blue",
    text: "text-blue-ink",
  },
  incident: {
    label: "Incident",
    dot: "bg-red",
    text: "text-red-ink",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-gray",
    text: "text-gray-ink",
  },
  // Release channel statuses
  developer: {
    label: "Developer",
    dot: "bg-indigo",
    text: "text-indigo-ink",
  },
  alpha: {
    label: "Alpha",
    dot: "bg-yellow",
    text: "text-yellow-ink",
  },
  beta: {
    label: "Beta",
    dot: "bg-blue",
    text: "text-blue-ink",
  },
  rc: {
    label: "RC",
    dot: "bg-cyan",
    text: "text-cyan-ink",
  },
  stable: {
    label: "Stable",
    dot: "bg-green",
    text: "text-green-ink",
  },
};

const statusIndicatorVariants = cva(
  "inline-flex items-center gap-2 rounded-full border font-medium",
  {
    variants: {
      size: {
        sm: "h-6 px-2 text-caption [&>[data-slot=status-dot]]:size-1.5",
        md: "h-7 px-3 text-caption [&>[data-slot=status-dot]]:size-2",
        lg: "h-8 px-3 text-footnote [&>[data-slot=status-dot]]:size-2.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

interface StatusIndicatorProps
  extends
    Omit<React.ComponentProps<"span">, "children">,
    VariantProps<typeof statusIndicatorVariants> {
  /** Current operational status. */
  status: Status;
  /** Custom label text. Auto-generated from status when omitted. */
  label?: string;
}

function StatusIndicator({ status, label, size, className, ...props }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config.label;

  return (
    <span
      data-slot="status-indicator"
      data-status={status}
      role="status"
      aria-label={displayLabel}
      className={cn(statusIndicatorVariants({ size }), "border-separator bg-surface", className)}
      {...props}
    >
      <span
        data-slot="status-dot"
        className={cn("relative shrink-0 rounded-full", config.dot)}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute inset-0 animate-ping rounded-full opacity-40 motion-reduce:animate-none",
            config.dot
          )}
        />
      </span>
      <span className={cn("whitespace-nowrap", config.text)}>{displayLabel}</span>
    </span>
  );
}

export { StatusIndicator, STATUS_CONFIG, type Status };
