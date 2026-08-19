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
  AlertOctagon,
  RefreshCw,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

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

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Terminal}
        title="System Logs Console"
        description="Search, filter, and audit database-backed logs, runtime exceptions, and Next.js client-side rejections."
      />

      {/* Volumetric Frosted Glass Filter Bar */}
      <Card className="border-border/40 bg-card/20 shadow-lg backdrop-blur-md">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search Input */}
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-semibold">
                Message / Content Search
              </Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search log messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background/40 border-border/60 pl-9 text-xs"
                />
              </div>
            </div>

            {/* Level Filter */}
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-semibold">Log Level</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="bg-background/40 border-border/60 text-xs">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/60">
                  <SelectItem value="ALL">All Levels</SelectItem>
                  <SelectItem value="DEBUG">DEBUG</SelectItem>
                  <SelectItem value="INFO">INFO</SelectItem>
                  <SelectItem value="WARN">WARN</SelectItem>
                  <SelectItem value="ERROR">ERROR</SelectItem>
                  <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                  <SelectItem value="FATAL">FATAL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-semibold">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-background/40 border-border/60 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/60">
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {LOG_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Filter */}
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-semibold">Filter by User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-background/40 border-border/60 text-xs">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/60 max-h-56">
                  <SelectItem value="ALL">All Users</SelectItem>
                  {usersData?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.clerkUserId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-border/20 mt-4 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Next.js Errors Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="nextjs-errors"
                  checked={nextJsErrors}
                  onCheckedChange={setNextJsErrors}
                />
                <Label
                  htmlFor="nextjs-errors"
                  className="text-foreground flex cursor-pointer items-center gap-1.5 text-xs font-semibold"
                >
                  <AlertOctagon className="h-4 w-4 text-rose-500" />
                  NextJS & Server Errors Only
                </Label>
              </div>

              {/* Auto Refresh Toggle */}
              <div className="flex items-center space-x-2">
                <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <Label
                  htmlFor="auto-refresh"
                  className="text-muted-foreground cursor-pointer text-xs font-semibold"
                >
                  Auto-refresh (8s)
                </Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isLoading || isFetching}
                className="border-border/60 h-8 gap-1.5 text-xs font-semibold"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Reload
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearLogs}
                disabled={clearLogsMutation.isPending}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Purge Database Logs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Terminal Output card */}
      <Card className="border-border/40 bg-card/20 shadow-xl backdrop-blur-md">
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="space-y-2 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
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
              className="border-border/30 text-foreground bg-black/10 dark:bg-black/40"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
