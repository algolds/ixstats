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
            {title && <h3 className="text-eyebrow">{title}</h3>}
            {description && (
              <p className="text-muted-foreground/70 text-xs font-medium">{description}</p>
            )}
          </div>
          {action && <div className="ml-3 shrink-0">{action}</div>}
        </div>
      )}

      <div className="border-separator bg-surface rounded-card divide-separator divide-y overflow-hidden border">
        {children}
      </div>

      {footer && (
        <div className="text-muted-foreground/60 px-2 pt-1 text-xs font-medium">{footer}</div>
      )}
    </div>
  );
}
