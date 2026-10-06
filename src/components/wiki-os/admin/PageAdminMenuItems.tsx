"use client";
// Move / Protect / Delete entries for the page tools menu, shown only for the rights the caller holds.

import Link from "next/link";
import { ArrowRight, Lock, Trash } from "iconoir-react";
import { api } from "~/trpc/react";
import { DropdownMenuItem, DropdownMenuSeparator } from "~/components/ui/dropdown-menu";
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
  const actions = enabled ? pageAdminActions(title.replace(/_/g, " "), data?.rights ?? []) : [];
  if (actions.length === 0) return null;

  return (
    <>
      <DropdownMenuSeparator />
      {actions.map((action) => {
        const Icon = ICONS[action.id];
        return (
          <DropdownMenuItem key={action.id} asChild>
            <Link href={withBasePath(action.href)} title={action.description}>
              <Icon className="size-4" />
              {action.label}
            </Link>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
