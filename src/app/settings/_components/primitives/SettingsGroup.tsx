import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function SettingsGroup({
  title,
  description,
  action,
  footer,
  className,
  children,
}: SettingsGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {(title || description || action) && (
        <div className="flex items-center justify-between px-2 pb-0.5">
          <div className="min-w-0 flex-1 space-y-0.5">
            {title && (
              <h3 className="text-muted-foreground/80 text-xs font-bold tracking-wider uppercase">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-muted-foreground/70 text-xs font-medium">{description}</p>
            )}
          </div>
          {action && <div className="ml-3 shrink-0">{action}</div>}
        </div>
      )}

      <div className="border-border/40 bg-card/40 divide-border/20 divide-y overflow-hidden rounded-2xl border shadow-xs backdrop-blur-md">
        {children}
      </div>

      {footer && (
        <div className="text-muted-foreground/60 px-2 pt-1 text-[11px] font-medium">{footer}</div>
      )}
    </div>
  );
}
