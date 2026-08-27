import type { ComponentType, ReactNode } from "react";
import { cn } from "~/lib/utils";

interface SettingsRowProps {
  label: string;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  glyphClass?: string;
  className?: string;
  children?: ReactNode;
}

export function SettingsRow({
  label,
  description,
  icon: Icon,
  glyphClass = "bg-primary/10 text-primary",
  className,
  children,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {Icon && (
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] transition-transform",
              glyphClass
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-foreground text-sm font-semibold tracking-tight">{label}</div>
          {description && (
            <div className="text-muted-foreground mt-0.5 text-xs leading-relaxed font-medium">
              {description}
            </div>
          )}
        </div>
      </div>

      {children && (
        <div className="flex shrink-0 items-center gap-2 sm:self-center">{children}</div>
      )}
    </div>
  );
}
