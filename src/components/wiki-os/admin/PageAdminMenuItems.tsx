"use client";
// src/components/wiki-os/admin/PageAdminMenuItems.tsx
// Move / Protect / Delete entries for the article page's More Tools menu, shown only for the rights the caller holds.

import Link from "next/link";
import { ArrowRight, Lock, Trash } from "iconoir-react";
import { api } from "~/trpc/react";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { withBasePath } from "~/lib/base-path";
import { pageAdminActions } from "~/lib/wiki-os/page-admin-ui";

const ICONS = { move: ArrowRight, protect: Lock, delete: Trash } as const;

/** Menu items (render inside a DropdownMenuContent) for the page-management actions `title` allows this user. */
export function PageAdminMenuItems({ title, enabled }: { title: string; enabled: boolean }) {
  const { data } = api.wikios.getUserPermissions.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  const actions = pageAdminActions(title.replace(/_/g, " "), data?.rights ?? []);

  return (
    <>
      {actions.map((action) => {
        const Icon = ICONS[action.id];
        return (
          <DropdownMenuItem key={action.id} asChild>
            <Link
              href={withBasePath(action.href)}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors hover:bg-[var(--wikios-border)]/50 focus:bg-[var(--wikios-border)]/50"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--wikios-text-muted)]" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[var(--wikios-text)]">{action.label}</div>
                <div className="truncate text-xs text-[var(--wikios-text-dim)]">
                  {action.description}
                </div>
              </div>
            </Link>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
