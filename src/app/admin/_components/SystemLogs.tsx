// src/app/admin/_components/SystemLogs.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { LogViewerFilterable, type LogEntry, type LogLevel } from "~/components/ui/log-viewer";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Activity, OpenNewWindow as ExternalLink, SystemRestart as Loader2 } from "iconoir-react";
import { toast } from "sonner";

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

  const clearLogsMutation = api.admin.clearSystemLogs.useMutation({
    onSuccess: () => {
      toast.success("System logs cleared successfully");
      void refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to clear logs");
    },
  });

  const handleClearLogs = () => {
    if (confirm("Are you sure you want to purge all system logs? This cannot be undone.")) {
      clearLogsMutation.mutate();
    }
  };

  // Map database logs to LogViewer entries format
  const entries: LogEntry[] = (logsData?.logs ?? []).map((log) => {
    let level: LogLevel = "info";
    const dbLevel = log.level?.toUpperCase();
    if (dbLevel === "DEBUG") level = "debug";
    else if (dbLevel === "WARN" || dbLevel === "WARNING") level = "warn";
    else if (dbLevel === "ERROR" || dbLevel === "CRITICAL" || dbLevel === "FATAL") level = "error";

    let msg = `[${log.category}] ${log.message}`;
    if (log.userId) msg += ` | user: ${log.userId}`;
    if (log.component) msg += ` | component: ${log.component}`;
    if (log.duration) msg += ` (${log.duration}ms)`;
    if (log.errorMessage) msg += `\nError: ${log.errorMessage}`;
    if (log.errorStack) msg += `\nStack: ${log.errorStack.slice(0, 1000)}`;

    return {
      level,
      message: msg,
      timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : undefined,
    };
  });

  return (
    <Card className="border-border/40 bg-card/30 backdrop-blur-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Activity className="h-4 w-4 text-indigo-500" />
            System Audit logs
          </CardTitle>
          <p className="text-muted-foreground text-xs">Live system execution trail and audit log</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="h-8 gap-1 text-xs">
            <Link href="/admin/user-logs">
              <ExternalLink className="h-3.5 w-3.5" />
              Dedicated View
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <LogViewerFilterable
            entries={entries}
            title="Latest System Logs"
            maxHeight={400}
            onClear={handleClearLogs}
            className="border-border/30 bg-black/10 dark:bg-black/30"
          />
        )}
      </CardContent>
    </Card>
  );
}
