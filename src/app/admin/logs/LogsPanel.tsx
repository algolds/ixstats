"use client";

import { useState, useEffect, useDeferredValue } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { api } from "~/trpc/react";
import { LogViewerFilterable, type LogEntry, type LogLevel } from "~/components/ui/log-viewer";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Terminal,
  Activity,
  User,
  WarningTriangle as AlertOctagon,
  Refresh as RefreshCw,
  Trash as Trash2,
  Search,
  SystemRestart as Loader2,
} from "iconoir-react";
import { toast } from "sonner";

export function LogsPanel() {
  return <DedicatedLogsPage />;
}

export default function DedicatedLogsPage() {
  usePageTitle({ title: "Admin - System Logs" });

  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const [selectedUser, setSelectedUser] = useState("ALL");
  const [nextJsErrors, setNextJsErrors] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch users for the dropdown filter
  const { data: usersData } = api.admin.listUsersWithCountries.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Query actual system logs from DB
  const {
    data: logsData,
    isLoading,
    refetch,
    isFetching,
  } = api.admin.getSystemLogs.useQuery(
    {
      limit: 150,
      searchTerm: deferredSearchTerm || undefined,
      userId: selectedUser !== "ALL" ? selectedUser : undefined,
      level: selectedLevel !== "ALL" ? selectedLevel : undefined,
      category: selectedCategory !== "ALL" ? selectedCategory : undefined,
      nextJsErrors,
    },
    {
      refetchInterval: autoRefresh ? 8000 : false, // Poll every 8s if autoRefresh is true
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
    if (confirm("Are you sure you want to purge all system logs? This action cannot be undone.")) {
      clearLogsMutation.mutate();
    }
  };

  // Categories from the logger configuration
  const LOG_CATEGORIES = [
    "AUTH",
    "API",
    "DATABASE",
    "SECURITY",
    "PERFORMANCE",
    "USER_ACTION",
    "COUNTRY_ACTION",
    "SYSTEM",
    "INTEGRATION",
    "AUDIT",
    "GENERAL",
    "USER_FEEDBACK",
  ];

  // Convert DB SystemLog entries to LogViewer entries
  const entries: LogEntry[] = (logsData?.logs ?? []).map((log) => {
    let level: LogLevel = "info";
    const dbLevel = log.level?.toUpperCase();
    if (dbLevel === "DEBUG") level = "debug";
    else if (dbLevel === "WARN" || dbLevel === "WARNING") level = "warn";
    else if (dbLevel === "ERROR" || dbLevel === "CRITICAL" || dbLevel === "FATAL") level = "error";

    let msg = `[${log.category}] ${log.message}`;
    if (log.userId) {
      const uMatch = usersData?.find((u) => u.id === log.userId);
      msg += ` | user: ${uMatch?.clerkUserId || log.userId}`;
    }
    if (log.component) msg += ` | component: ${log.component}`;
    if (log.endpoint) msg += ` | path: ${log.endpoint}`;
    if (log.duration) msg += ` (${log.duration}ms)`;
    if (log.errorMessage) msg += `\nError: ${log.errorMessage}`;
    if (log.errorStack) msg += `\nStack: ${log.errorStack}`;
    if (log.metadata) msg += `\nMetadata: ${log.metadata}`;

    return {
      level,
      message: msg,
      timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : undefined,
    };
  });

  const errorCount = entries.filter((e) => e.level === "error" || e.level === "warn").length;

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Terminal}
        title="System Logs Console"
        description="Search, filter, and audit database-backed logs, runtime exceptions, and Next.js client-side rejections."
      />

      {/* Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Fetched Logs</p>
          <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">{entries.length}</p>
        </div>
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Errors / Warnings</p>
          <p className={`mt-1 font-mono text-xl font-bold tracking-tight ${errorCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {errorCount}
          </p>
        </div>
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Auto-Refresh</p>
          <p className="text-cyan-400 mt-1 font-mono text-xl font-bold tracking-tight">{autoRefresh ? "8s Live" : "Paused"}</p>
        </div>
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Level Scope</p>
          <p className="text-purple-400 mt-1 font-mono text-xl font-bold tracking-tight">{selectedLevel}</p>
        </div>
      </div>

      {/* Single-line Filter Rail */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search log messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 rounded-xl border-border/30 bg-background/50 pl-8 text-xs backdrop-blur-md focus:border-border/60"
            />
          </div>

          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="h-8 w-32 rounded-xl border-border/30 bg-background/50 text-xs backdrop-blur-md">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Levels</SelectItem>
              <SelectItem value="DEBUG" className="text-xs">DEBUG</SelectItem>
              <SelectItem value="INFO" className="text-xs">INFO</SelectItem>
              <SelectItem value="WARN" className="text-xs">WARN</SelectItem>
              <SelectItem value="ERROR" className="text-xs">ERROR</SelectItem>
              <SelectItem value="CRITICAL" className="text-xs">CRITICAL</SelectItem>
              <SelectItem value="FATAL" className="text-xs">FATAL</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 w-36 rounded-xl border-border/30 bg-background/50 text-xs backdrop-blur-md">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Categories</SelectItem>
              {LOG_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="h-8 w-36 rounded-xl border-border/30 bg-background/50 text-xs backdrop-blur-md">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              <SelectItem value="ALL" className="text-xs">All Users</SelectItem>
              {usersData?.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  {u.clerkUserId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Switch
              id="nextjs-errors"
              checked={nextJsErrors}
              onCheckedChange={setNextJsErrors}
              className="scale-75"
            />
            <span>Errors only</span>
          </label>

          <label className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              className="scale-75"
            />
            <span>Auto-refresh</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading || isFetching}
            className="h-8 rounded-xl px-3 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Reload
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearLogs}
            disabled={clearLogsMutation.isPending}
            className="h-8 rounded-xl px-3 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Purge Logs
          </Button>
        </div>
      </div>

      {/* Main Terminal Output */}
      <div className="overflow-hidden rounded-2xl border border-border/30 bg-card/25 p-3 backdrop-blur-md shadow-xs">
        {isLoading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="space-y-2 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-xs">
                Querying database systemLog entries...
              </p>
            </div>
          </div>
        ) : (
          <LogViewerFilterable
            entries={entries}
            title={`System Event Stream (${entries.length} fetched)`}
            maxHeight={600}
            className="border-border/20 text-foreground bg-black/10 dark:bg-black/40 rounded-xl"
          />
        )}
      </div>
    </div>
  );
}
