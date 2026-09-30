import * as React from "react";
import { cn } from "~/lib/utils/cn";

/**
 * EmptyState (Facet 3 §7.1): an icon, a `text-title-3` title, a `text-callout` message and at
 * most one action, centred. `compact` fits inside a card or list group.
 *
 *   <EmptyState icon={<Page />} title="No drafts" message="Drafts you save appear here."
 *     action={<Button>New draft</Button>} />
 */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** A decorative icon element (sized 40px, or 32px when compact; `label-secondary`). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  message?: React.ReactNode;
  /** One action (a Button or link). */
  action?: React.ReactNode;
  /** Tighter padding and a smaller icon, for use inside cards. */
  compact?: boolean;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, message, action, compact = false, className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className
      )}
      {...props}
    >
      {icon != null && icon !== false && (
        <span
          aria-hidden
          data-slot="empty-state-icon"
          className={cn(
            "text-label-secondary flex items-center justify-center [&_svg]:size-full",
            compact ? "size-8" : "size-10"
          )}
        >
          {icon}
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-title-3 text-label">{title}</p>
        {message != null && message !== false && (
          <p className="text-callout text-label-secondary">{message}</p>
        )}
      </div>
      {action != null && action !== false && <div className={compact ? "pt-1" : "pt-2"}>{action}</div>}
    </div>
  )
);
EmptyState.displayName = "EmptyState";
