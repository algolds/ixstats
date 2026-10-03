import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils/cn";

/** In a status variant the icon and title take the ink; the description stays `label`. */
const STATUS_DESCRIPTION = "*:data-[slot=alert-description]:text-label";

/**
 * An inline, opaque message block (not an overlay — use `AlertDialog` to confirm).
 *
 * Variants: `default` (surface + hairline) · status roles `destructive`, `warning`, `caution`,
 * `success`, `info` as the status `-ink` on a 15% fill of the colour (≥ 4.5:1 on every background
 * role, light/dark, Increase Contrast — token-contrast.test.ts). Pair the colour with an icon or
 * title.
 *
 * Role: `alert` (assertive) for `default`, `destructive`, `warning` and `caution`; `status`
 * (polite) for `info` and `success`. Pass `role` to override (e.g. `role="note"` for static hints).
 */
const alertVariants = cva(
  [
    "relative grid w-full items-start gap-y-1 rounded-card border px-4 py-3 text-callout",
    "grid-cols-[0_1fr] has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3",
    "[:where(&)>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-separator bg-surface text-label",
        destructive: `border-destructive/30 bg-destructive/15 text-destructive-ink ${STATUS_DESCRIPTION}`,
        warning: `border-warning/30 bg-warning/15 text-warning-ink ${STATUS_DESCRIPTION}`,
        caution: `border-caution/30 bg-caution/15 text-caution-ink ${STATUS_DESCRIPTION}`,
        success: `border-success/30 bg-success/15 text-success-ink ${STATUS_DESCRIPTION}`,
        info: `border-info/30 bg-info/15 text-info-ink ${STATUS_DESCRIPTION}`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

const POLITE: ReadonlySet<AlertVariant> = new Set<AlertVariant>(["info", "success"]);

function Alert({
  className,
  variant,
  role,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const v = variant ?? "default";
  return (
    <div
      data-slot="alert"
      data-variant={v}
      role={role ?? (POLITE.has(v) ? "status" : "alert")}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("text-headline col-start-2 line-clamp-1 min-h-4", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-callout text-label-secondary col-start-2 grid justify-items-start gap-1 [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
