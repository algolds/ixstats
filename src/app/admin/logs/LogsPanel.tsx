"use client";

import { useState, useDeferredValue } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { api } from "~/trpc/react";
import { LogViewerFilterable, type LogEntry, type LogLevel } from "~/components/admin/log-viewer";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
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
  Refresh as RefreshCw,
  Trash as Trash2,
  Search,
  SystemRestart as Loader2,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard } from "~/components/ui/facet-container";

export function LogsPanel() {
  return <DedicatedLogsPage />;
}

export default function DedicatedLogsPage() {
  const notify = useNotify();
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
      notify.success("System logs cleared successfully");
      void refetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to clear logs");
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
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Fetched Logs</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">{entries.length}</p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Errors / Warnings</p>
          <p
            className={`text-title-2 mt-1 tabular-nums ${errorCount > 0 ? "text-red" : "text-green"}`}
          >
            {errorCount}
          </p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Auto-Refresh</p>
          <p className="text-title-2 text-teal mt-1 tabular-nums">
            {autoRefresh ? "8s Live" : "Paused"}
          </p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Level Scope</p>
          <p className="text-title-2 text-purple mt-1 tabular-nums">{selectedLevel}</p>
        </FacetCard>
      </div>

      {/* Single-line Filter Rail */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-xs min-w-[180px] flex-1">
            <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search log messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
            />
          </div>

          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-footnote">
                All Levels
              </SelectItem>
              <SelectItem value="DEBUG" className="text-footnote">
                DEBUG
              </SelectItem>
              <SelectItem value="INFO" className="text-footnote">
                INFO
              </SelectItem>
              <SelectItem value="WARN" className="text-footnote">
                WARN
              </SelectItem>
              <SelectItem value="ERROR" className="text-footnote">
                ERROR
              </SelectItem>
              <SelectItem value="CRITICAL" className="text-footnote">
                CRITICAL
              </SelectItem>
              <SelectItem value="FATAL" className="text-footnote">
                FATAL
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-footnote">
                All Categories
              </SelectItem>
              {LOG_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-footnote">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              <SelectItem value="ALL" className="text-footnote">
                All Users
              </SelectItem>
              {usersData?.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-footnote">
                  {u.clerkUserId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-1.5 px-2 select-none">
            <Switch
              id="nextjs-errors"
              checked={nextJsErrors}
              onCheckedChange={setNextJsErrors}
              className="scale-75"
            />
            <span>Errors only</span>
          </label>

          <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-1.5 px-2 select-none">
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
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Reload
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearLogs}
            disabled={clearLogsMutation.isPending}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Purge Logs
          </Button>
        </div>
      </div>

      {/* Main Terminal Output */}
      <FacetCard className="overflow-hidden p-3">
        {isLoading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="space-y-2 text-center">
              <Loader2 className="text-tint mx-auto h-8 w-8 animate-spin" />
              <p className="text-label-secondary text-footnote">
                Querying database systemLog entries...
              </p>
            </div>
          </div>
        ) : (
          <LogViewerFilterable
            entries={entries}
            title={`System Event Stream (${entries.length} fetched)`}
            maxHeight={600}
            className="border-separator text-label rounded-row bg-fill-4"
          />
        )}
      </FacetCard>
    </div>
  );
}
