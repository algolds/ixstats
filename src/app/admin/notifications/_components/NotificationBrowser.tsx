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
  Trash as Trash2,
  Undo as RotateCcw,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  WarningTriangle as AlertTriangle,
  CheckCircle,
  InfoCircle as Info,
  WarningCircle as AlertCircle,
  Group as Users,
  Globe,
  Flash as Zap,
  Bell,
  Eye,
  EyeClosed as EyeOff,
} from "iconoir-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "~/lib/utils";
import {
  SwipeableRow,
  SwipeableGroup,
  SwipeActionButton,
} from "~/components/ui/facet/swipeable/SwipeableRow";
import { motion } from "motion/react";

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
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
  { value: "all", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function getTypeIcon(type: string | null) {
  switch (type) {
    case "info":
      return <Info className="text-blue h-4 w-4" />;
    case "warning":
      return <AlertTriangle className="text-yellow h-4 w-4" />;
    case "success":
      return <CheckCircle className="text-green h-4 w-4" />;
    case "error":
      return <AlertCircle className="text-red h-4 w-4" />;
    case "crisis":
      return <AlertTriangle className="text-red h-4 w-4" />;
    case "economic":
      return <Zap className="text-purple h-4 w-4" />;
    case "diplomatic":
      return <Users className="text-indigo h-4 w-4" />;
    default:
      return <Bell className="text-label-secondary h-4 w-4" />;
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
      ? { bg: "bg-red/10", text: "text-red" }
      : n.priority === "high"
        ? { bg: "bg-orange/10", text: "text-orange" }
        : n.priority === "medium"
          ? { bg: "bg-yellow/10", text: "text-yellow" }
          : { bg: "bg-fill-3", text: "text-label-secondary" };

  return (
    <SwipeableRow
      id={n.id}
      className="rounded-row mb-2 overflow-hidden last:mb-0"
      springPreset="tight"
      expanded={isExpanded}
      onExpandedChange={setIsExpanded}
    >
      {/* Trailing Action: swipe left to delete */}
      <SwipeableRow.Trailing
        commit={{
          action: () => handleDelete(n.id),
          label: "Delete",
          color: "var(--color-error)",
        }}
      >
        <SwipeActionButton
          id="delete"
          icon={Trash2}
          label="Delete"
          onClick={() => handleDelete(n.id)}
          color="var(--color-error)"
        />
      </SwipeableRow.Trailing>

      {/* Main card content */}
      <SwipeableRow.Content>
        <div
          className={cn(
            "rounded-row border-separator bg-fill-4 hover:border-separator hover:bg-fill-4 duration-fast relative flex cursor-grab items-center justify-between border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:cursor-grabbing",
            !n.read && "border-blue/30 bg-blue/5"
          )}
        >
          {/* Left indicator accent border */}
          <div
            className={cn(
              "rounded-l-row duration-fast absolute top-0 bottom-0 left-0 w-[3px] transition-[color,background-color,border-color,box-shadow,opacity,transform]",
              colors.text.replace("text-", "bg-")
            )}
          />

          <div className="flex min-w-0 flex-1 items-center gap-3 pl-2">
            <div
              className={cn(
                "rounded-control border-separator flex h-8 w-8 shrink-0 items-center justify-center border",
                colors.bg
              )}
            >
              {typeIcon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label text-headline max-w-[280px] truncate">{n.title}</span>
                {!n.read && <span className="bg-blue h-1.5 w-1.5 animate-pulse rounded-full" />}
                <Badge
                  variant="outline"
                  className="text-label-secondary border-separator text-eyebrow h-4 px-2 py-0"
                >
                  {n.category || n.type || "system"}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-label-secondary border-separator flex h-4 items-center gap-1 px-2 py-0"
                >
                  {scope.icon}
                  <span>{scope.label}</span>
                </Badge>
                <Badge
                  variant={
                    n.priority === "critical"
                      ? "destructive"
                      : n.priority === "high"
                        ? "secondary"
                        : "default"
                  }
                  className="h-4 px-2 py-0 leading-none"
                >
                  {n.priority}
                </Badge>
              </div>
              {n.description && (
                <div className="text-label-secondary text-footnote mt-1 max-w-[500px] truncate">
                  {n.description}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2 pl-3">
            <span className="text-label-secondary text-caption whitespace-nowrap">
              {formattedTime}
            </span>
            <div className="flex items-center gap-2">
              {n.read ? (
                <span title="Read">
                  <Eye className="text-label-secondary h-3.5 w-3.5" />
                </span>
              ) : (
                <span title="Unread">
                  <EyeOff className="text-blue h-3.5 w-3.5" />
                </span>
              )}
              <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                <ChevronRight className="text-label-tertiary h-4 w-4" />
              </motion.div>
            </div>
          </div>
        </div>
      </SwipeableRow.Content>

      {/* Expanded details */}
      <SwipeableRow.Expanded>
        <div className="rounded-b-row border-separator bg-fill-3 space-y-3 border-t p-4 pl-[52px]">
          {n.message && (
            <div className="space-y-1">
              <span className="text-label-secondary text-eyebrow">Full Message</span>
              <p className="text-label text-caption leading-relaxed whitespace-pre-wrap select-text">
                {n.message}
              </p>
            </div>
          )}
          {n.description && !n.message && (
            <div className="space-y-1">
              <span className="text-label-secondary text-eyebrow">Description</span>
              <p className="text-label text-caption leading-relaxed whitespace-pre-wrap select-text">
                {n.description}
              </p>
            </div>
          )}

          <div className="border-separator text-footnote grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-2">
            <div>
              <span className="text-label-secondary font-semibold">User ID:</span>{" "}
              <code className="text-label rounded-control-sm bg-fill-4 px-1 py-0.5">
                {n.userId || "Global / System"}
              </code>
            </div>
            <div>
              <span className="text-label-secondary font-semibold">Country ID:</span>{" "}
              <code className="text-label rounded-control-sm bg-fill-4 px-1 py-0.5">
                {n.countryId || "Global / System"}
              </code>
            </div>
            {n.href && (
              <div className="col-span-2">
                <span className="text-label-secondary font-semibold">Target URL:</span>{" "}
                <a href={n.href} className="text-blue hover:underline">
                  {n.href}
                </a>
              </div>
            )}
            {n.metadata && (
              <div className="col-span-2 mt-1 space-y-1">
                <span className="text-label-secondary font-semibold">Metadata:</span>
                <pre className="rounded-control-sm border-separator text-footnote text-label bg-surface-secondary max-w-full overflow-x-auto border p-2 font-mono">
                  {JSON.stringify(JSON.parse(n.metadata), null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => handleDelete(n.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-3 w-3" />
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [readFilter, setReadFilter] = useState<string>("all");
  const limit = 50;

  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = api.notifications.getAllAdminNotifications.useQuery({
    limit,
    offset: page * limit,
    type: typeFilter === "all" ? undefined : typeFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
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
          <Search className="text-label-secondary absolute top-2 left-2 h-4 w-4" />
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
            <SelectItem value="all">All</SelectItem>
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
          className="text-destructive"
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
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader className="py-3">
          <CardTitle className="text-body flex items-center justify-between">
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
              <div className="text-label-secondary py-8 text-center">Loading...</div>
            ) : data?.notifications.length === 0 ? (
              <div className="text-label-secondary py-8 text-center">
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
          <span className="text-label-secondary text-body">
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
