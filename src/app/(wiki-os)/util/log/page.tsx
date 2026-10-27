"use client";
// src/app/(wiki-os)/util/log/page.tsx
// Special:Log — moves, deletions, protections, blocks and group changes, newest first.

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { AdminPage, FormField } from "~/components/wiki-os/admin/AdminPage";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { LOG_TYPE_OPTIONS, describeLogEntry } from "~/lib/wiki-os/page-admin-ui";

type LogFilter = (typeof LOG_TYPE_OPTIONS)[number]["value"] | "all";

const isLogFilter = (value: string): value is LogFilter =>
  value === "all" || LOG_TYPE_OPTIONS.some((option) => option.value === value);

const pageHref = (title: string) => `/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

export default function LogPage() {
  const params = useSearchParams();
  const initialType = params.get("type") ?? "all";
  const [type, setType] = useState<LogFilter>(isLogFilter(initialType) ? initialType : "all");
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [user, setUser] = useState(params.get("user") ?? "");
  const [applied, setApplied] = useState({ type, title: title.trim(), user: user.trim() });

  const log = api.wikios.getLog.useInfiniteQuery(
    {
      type: applied.type === "all" ? undefined : applied.type,
      title: applied.title || undefined,
      user: applied.user || undefined,
      limit: 50,
    },
    { getNextPageParam: (last) => last.nextCursor ?? undefined }
  );
  const entries = log.data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <AdminPage
      title="Log"
      description="Page moves, deletions, protections, blocks and changes to user groups."
    >
      <form
        className="grid gap-3 sm:grid-cols-[12rem_1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ type, title: title.trim(), user: user.trim() });
        }}
      >
        <FormField label="Type">
          <Select value={type} onValueChange={(next) => isLogFilter(next) && setType(next)}>
            <SelectTrigger aria-label="Log type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All logs</SelectItem>
              {LOG_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Page or user page" htmlFor="log-title">
          <Input id="log-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Performed by" htmlFor="log-user">
          <Input id="log-user" value={user} onChange={(e) => setUser(e.target.value)} />
        </FormField>
        <Button type="submit" variant="outline">
          Show
        </Button>
      </form>

      {log.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
      {log.error && <p className="text-destructive text-sm">{log.error.message}</p>}
      {!log.isLoading && entries.length === 0 && (
        <p className="text-muted-foreground text-sm">No log entries match.</p>
      )}

      <ul className="divide-border border-border divide-y rounded-xl border">
        {entries.map((entry) => (
          <li key={entry.id} className="space-y-0.5 p-3 text-sm">
            <p>
              <span className="text-muted-foreground text-xs">
                {entry.timestamp.toLocaleString()}
              </span>{" "}
              <Link
                href={pageHref(`User:${entry.actor}`)}
                className="text-foreground font-semibold hover:underline"
              >
                {entry.actor}
              </Link>{" "}
              {describeLogEntry(entry)}
              {entry.comment ? (
                <span className="text-muted-foreground"> ({entry.comment})</span>
              ) : null}
            </p>
            <Link
              href={pageHref(entry.title)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {entry.title}
            </Link>
          </li>
        ))}
      </ul>

      {log.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => void log.fetchNextPage()}
          disabled={log.isFetchingNextPage}
        >
          {log.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </AdminPage>
  );
}
