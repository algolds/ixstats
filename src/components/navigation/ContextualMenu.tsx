"use client";

import Link from "next/link";
import type { ContextualMenuDefinition } from "~/lib/navigation-config";

export interface ContextualMenuProps {
  contextMenu: ContextualMenuDefinition;
  normalizedPathname: string;
  onNavigate: () => void;
}

/**
 * Renders the page-aware contextual menu groups shown inside the mobile menu
 * panel. Extracted from navigation.tsx. Each item links to a context-specific
 * destination and highlights when active.
 */
export function ContextualMenu({
  contextMenu,
  normalizedPathname,
  onNavigate,
}: ContextualMenuProps) {
  return (
    <>
      {contextMenu.groups.map((group) => (
        <div key={group.title}>
          <p className="text-muted-foreground/80 text-xs font-semibold tracking-wide uppercase">
            {group.title}
          </p>
          <div className="mt-3 space-y-2">
            {group.items.map((item) => {
              const Icon = item.icon;
              const targetHref = item.href.split("?")[0].split("#")[0] || "/";
              const active =
                normalizedPathname === targetHref ||
                (targetHref !== "/" && normalizedPathname.startsWith(`${targetHref}/`));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                      : "border-border/40 text-muted-foreground hover:border-border hover:bg-accent/10 hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted/60"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-medium break-words">{item.name}</p>
                    {item.description && (
                      <p className="text-muted-foreground text-xs leading-tight break-words">
                        {item.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
