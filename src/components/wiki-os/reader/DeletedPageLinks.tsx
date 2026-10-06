"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

/**
 * Under the 404 of a page that may have been deleted: a reader who holds `deletedhistory` (the only
 * one who can see that a deleted page exists) is pointed at the deletion log and the undelete screen,
 * as MediaWiki does. Everyone else sees nothing: to them the page does not exist.
 */
export function DeletedPageLinks({ title, enabled }: { title: string; enabled: boolean }) {
  const { data } = api.wikios.getUserPermissions.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  if (!data?.rights.includes("deletedhistory")) return null;

  const query = `?title=${encodeURIComponent(title)}`;
  return (
    <p className="text-muted-foreground mt-4 text-xs" role="note">
      If this page was deleted, see the{" "}
      <Link
        href={withBasePath(`/util/log${query}&type=delete`)}
        className="hover:text-wiki underline underline-offset-2"
      >
        deletion log
      </Link>
      {data.rights.includes("undelete") && (
        <>
          {" "}
          or{" "}
          <Link
            href={withBasePath(`/util/undelete${query}`)}
            className="hover:text-wiki underline underline-offset-2"
          >
            restore it
          </Link>
        </>
      )}
      .
    </p>
  );
}
