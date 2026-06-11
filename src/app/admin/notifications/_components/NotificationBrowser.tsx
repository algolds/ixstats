"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useNotify } from "~/hooks/useNotify";
import {
  Search,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Info,
  AlertCircle,
  Users,
  Globe,
  Zap,
  Bell,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "~/lib/utils";
import { SwipeableRow, SwipeableGroup, SwipeActionButton } from "~/components/facet-ui/swipeable";
import { motion } from "motion/react";

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
  { value: "alert", label: "Alert" },
  { value: "update", label: "Update" },
  { value: "economic", label: "Economic" },
  { value: "crisis", label: "Crisis" },
  { value: "diplomatic", label: "Diplomatic" },
  { value: "system", label: "System" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function getTypeIcon(type: string | null) {
  switch (type) {
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "crisis":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "economic":
      return <Zap className="h-4 w-4 text-purple-500" />;
    case "diplomatic":
      return <Users className="h-4 w-4 text-indigo-500" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500" />;
  }
}

function getScopeLabel(notification: { userId: string | null; countryId: string | null }) {
  if (notification.userId) return { label: "User", icon: <Users className="h-3 w-3" /> };
  if (notification.countryId) return { label: "Country", icon: <Globe className="h-3 w-3" /> };
  return { label: "Global", icon: <Zap className="h-3 w-3" /> };
}

interface AdminNotificationRowProps {
  n: any;
  handleDelete: (id: string) => void;
  deleteMutation: any;
}

function AdminNotificationRow({ n, handleDelete, deleteMutation }: AdminNotificationRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const scope = getScopeLabel(n);
  const typeIcon = getTypeIcon(n.type);
  const formattedTime = formatDistanceToNow(new Date(n.createdAt), { addSuffix: true });

  const colors =
    n.priority === "critical"
      ? { bg: "bg-red-500/10", text: "text-red-500" }
      : n.priority === "high"
        ? { bg: "bg-orange-500/10", text: "text-orange-500" }
        : n.priority === "medium"
          ? { bg: "bg-yellow-500/10", text: "text-yellow-500" }
          : { bg: "bg-slate-500/10", text: "text-slate-400" };

  return (
    <SwipeableRow
      id={n.id}
      className="rounded-xl overflow-hidden mb-2 last:mb-0"
      springPreset="tight"
      expanded={isExpanded}
      onExpandedChange={setIsExpanded}
    >
      {/* Trailing Action: swipe left to delete */}
      <SwipeableRow.Trailing
        commit={{
          action: () => handleDelete(n.id),
          label: "Delete",
          color: "#ef4444",
        }}
      >
        <SwipeActionButton
          id="delete"
          icon={Trash2}
          label="Delete"
          onClick={() => handleDelete(n.id)}
          color="#ef4444"
        />
      </SwipeableRow.Trailing>

      {/* Main card content */}
      <SwipeableRow.Content>
        <div
          className={cn(
            "relative flex items-center justify-between p-3.5 bg-white/[0.05] dark:bg-slate-950/75 backdrop-blur-md border border-white/[0.08] dark:border-white/10 rounded-xl hover:bg-white/[0.08] dark:hover:bg-slate-900/80 hover:border-white/[0.12] transition-all duration-200 cursor-grab active:cursor-grabbing",
            !n.read && "bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/30"
          )}
        >
          {/* Left indicator accent border */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-all duration-300",
              colors.text.replace("text-", "bg-")
            )}
          />

          <div className="flex items-center gap-3 pl-1.5 flex-1 min-w-0">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5",
                colors.bg
              )}
            >
              {typeIcon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground text-sm font-semibold truncate max-w-[280px]">
                  {n.title}
                </span>
                {!n.read && (
                  <span className="bg-blue-500 h-1.5 w-1.5 rounded-full animate-pulse shadow-sm shadow-blue-500/50" />
                )}
                <Badge
                  variant="outline"
                  className="text-[9px] uppercase tracking-wider py-0 px-1.5 h-4 border-white/10 text-muted-foreground"
                >
                  {n.category || n.type || "system"}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[9px] py-0 px-1.5 h-4 border-white/10 text-muted-foreground flex items-center gap-1"
                >
                  {scope.icon}
                  <span>{scope.label}</span>
                </Badge>
                <Badge
                  variant={
                    n.priority === "critical"
                      ? "destructive"
                      : n.priority === "high"
                        ? "default"
                        : "secondary"
                  }
                  className="text-[9px] py-0 px-1.5 h-4 leading-none"
                >
                  {n.priority}
                </Badge>
              </div>
              {n.description && (
                <div className="text-muted-foreground text-xs mt-1 truncate max-w-[500px]">
                  {n.description}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0 pl-3">
            <span className="text-muted-foreground/80 text-[10px] font-medium whitespace-nowrap">
              {formattedTime}
            </span>
            <div className="flex items-center gap-1.5">
              {n.read ? (
                <span title="Read">
                  <Eye className="text-muted-foreground/60 h-3.5 w-3.5" />
                </span>
              ) : (
                <span title="Unread">
                  <EyeOff className="h-3.5 w-3.5 text-blue-400" />
                </span>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </motion.div>
            </div>
          </div>
        </div>
      </SwipeableRow.Content>

      {/* Expanded details */}
      <SwipeableRow.Expanded>
        <div className="border-t border-white/5 bg-slate-950/40 p-4 rounded-b-xl space-y-3 pl-[52px]">
          {n.message && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Full Message
              </span>
              <p className="text-xs text-foreground/90 font-medium whitespace-pre-wrap leading-relaxed select-text">
                {n.message}
              </p>
            </div>
          )}
          {n.description && !n.message && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Description
              </span>
              <p className="text-xs text-foreground/90 font-medium whitespace-pre-wrap leading-relaxed select-text">
                {n.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-2 text-[10px] border-t border-white/5">
            <div>
              <span className="text-muted-foreground font-semibold">User ID:</span>{" "}
              <code className="text-foreground/90 bg-white/5 px-1 py-0.5 rounded">
                {n.userId || "Global / System"}
              </code>
            </div>
            <div>
              <span className="text-muted-foreground font-semibold">Country ID:</span>{" "}
              <code className="text-foreground/90 bg-white/5 px-1 py-0.5 rounded">
                {n.countryId || "Global / System"}
              </code>
            </div>
            {n.href && (
              <div className="col-span-2">
                <span className="text-muted-foreground font-semibold">Target URL:</span>{" "}
                <a href={n.href} className="text-blue-400 hover:underline">
                  {n.href}
                </a>
              </div>
            )}
            {n.metadata && (
              <div className="col-span-2 space-y-1 mt-1">
                <span className="text-muted-foreground font-semibold">Metadata:</span>
                <pre className="text-[10px] bg-black/30 p-2 rounded border border-white/5 text-emerald-400 overflow-x-auto max-w-full font-mono">
                  {JSON.stringify(JSON.parse(n.metadata), null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] text-red-400 hover:text-red-500 hover:bg-red-500/10 border-red-500/20"
              onClick={() => handleDelete(n.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              Delete Notification
            </Button>
          </div>
        </div>
      </SwipeableRow.Expanded>
    </SwipeableRow>
  );
}

export function NotificationBrowser() {
  const notify = useNotify();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [readFilter, setReadFilter] = useState<string>("");
  const limit = 50;

  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = api.notifications.getAllAdminNotifications.useQuery({
    limit,
    offset: page * limit,
    type: typeFilter || undefined,
    priority: priorityFilter || undefined,
    search: search || undefined,
    read: readFilter === "read" ? true : readFilter === "unread" ? false : undefined,
  });

  const deleteMutation = api.notifications.deleteNotification.useMutation({
    onSuccess: () => {
      notify.success("Notification deleted");
      refetch();
    },
    onError: (e) => notify.error("Delete failed", e.message),
  });

  const handleDelete = (id: string) => {
    setLocallyDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    deleteMutation.mutate({
      notificationId: id,
      adminUserId: "system-admin",
    });
  };

  const deleteAllMutation = api.notifications.deleteAllNotifications.useMutation({
    onSuccess: (res) => {
      notify.success("All notifications cleared", `${res.count} removed`);
      refetch();
    },
    onError: (e) => notify.error("Clear failed", e.message),
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder="Search title, description, message..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-8"
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={(v) => {
            setPriorityFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={readFilter}
          onValueChange={(v) => {
            setReadFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Read status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
          onClick={() => {
            if (confirm("Delete ALL notifications from database? This cannot be undone.")) {
              deleteAllMutation.mutate({ adminUserId: "system-admin" });
            }
          }}
          disabled={deleteAllMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear All
        </Button>
      </div>

      {/* List container */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>
              {data
                ? `${data.totalCount} notification${data.totalCount !== 1 ? "s" : ""}`
                : "Loading..."}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <ScrollArea className="max-h-[600px] pr-2">
            {isLoading ? (
              <div className="text-muted-foreground py-8 text-center">Loading...</div>
            ) : data?.notifications.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                No notifications found
              </div>
            ) : (
              <SwipeableGroup>
                <div className="space-y-2">
                  {data?.notifications
                    .filter((n) => !locallyDeletedIds.has(n.id))
                    .map((n) => (
                      <AdminNotificationRow
                        key={n.id}
                        n={n}
                        handleDelete={handleDelete}
                        deleteMutation={deleteMutation}
                      />
                    ))}
                </div>
              </SwipeableGroup>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalCount > limit && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page + 1} of {Math.ceil(data.totalCount / limit)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
