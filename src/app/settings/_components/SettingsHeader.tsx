import type { ReactNode } from "react";
import Link from "next/link";
import { NavArrowRight } from "iconoir-react";

interface SettingsHeaderProps {
  title: string;
  description?: string;
  category?: string;
  actions?: ReactNode;
}

export function SettingsHeader({ title, description, category, actions }: SettingsHeaderProps) {
  return (
    <div className="border-border/20 mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {/* Breadcrumb Trail */}
        <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs font-semibold">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            Settings
          </Link>
          {category && (
            <>
              <NavArrowRight className="h-3 w-3" />
              <span>{category}</span>
            </>
          )}
          <NavArrowRight className="h-3 w-3" />
          <span className="text-foreground">{title}</span>
        </div>

        <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="text-muted-foreground max-w-2xl text-xs font-medium">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2.5 self-start sm:self-end">{actions}</div>
      )}
    </div>
  );
}
