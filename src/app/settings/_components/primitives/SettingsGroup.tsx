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
          <div className="space-y-0.5 min-w-0 flex-1">
            {title && (
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground/80 uppercase">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs font-medium text-muted-foreground/70">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 ml-3">{action}</div>}
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md shadow-xs divide-y divide-border/20 overflow-hidden">
        {children}
      </div>

      {footer && (
        <div className="px-2 pt-1 text-[11px] font-medium text-muted-foreground/60">
          {footer}
        </div>
      )}
    </div>
  );
}
