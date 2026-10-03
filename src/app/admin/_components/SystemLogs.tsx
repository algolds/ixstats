"use client";
// src/app/admin/_components/SystemLogs.tsx

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { LogViewerFilterable, type LogEntry } from "~/components/admin/log-viewer";
import { toLogLevel, useClearSystemLogs } from "../_hooks/useSystemLogs";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Activity, OpenNewWindow as ExternalLink, SystemRestart as Loader2 } from "iconoir-react";

export function SystemLogs() {
  const [limit] = useState(100);

  // Fetch actual logs from the database
  const {
    data: logsData,
    isLoading,
    refetch,
  } = api.admin.getSystemLogs.useQuery(
    { limit },
    {
      refetchInterval: 10000, // Refresh logs every 10 seconds automatically
      refetchOnWindowFocus: false,
    }
  );

  const handleClearLogs = useClearSystemLogs(
    refetch,
    "Are you sure you want to purge all system logs? This cannot be undone."
  );

  // Map database logs to LogViewer entries format
  const entries: LogEntry[] = (logsData?.logs ?? []).map((log) => {
    let msg = `[${log.category}] ${log.message}`;
    if (log.userId) msg += ` | user: ${log.userId}`;
    if (log.component) msg += ` | component: ${log.component}`;
    if (log.duration) msg += ` (${log.duration}ms)`;
    if (log.errorMessage) msg += `\nError: ${log.errorMessage}`;
    if (log.errorStack) msg += `\nStack: ${log.errorStack.slice(0, 1000)}`;

    return {
      level: toLogLevel(log.level),
      message: msg,
      timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : undefined,
    };
  });

  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-0.5">
          <CardTitle className="text-headline flex items-center gap-2">
            <Activity className="text-indigo h-4 w-4" />
            System Audit logs
          </CardTitle>
          <p className="text-label-secondary text-footnote">
            Live system execution trail and audit log
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1">
            <Link href="/admin/logs">
              <ExternalLink className="h-3.5 w-3.5" />
              Dedicated view
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="text-indigo h-6 w-6 animate-spin" />
          </div>
        ) : (
          <LogViewerFilterable
            entries={entries}
            title="Latest system logs"
            maxHeight={400}
            onClear={handleClearLogs}
            className="border-separator bg-fill-4"
          />
        )}
      </CardContent>
    </Card>
  );
}
