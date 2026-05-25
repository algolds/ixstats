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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
    case "info": return <Info className="h-4 w-4 text-blue-500" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "error": return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "crisis": return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "economic": return <Zap className="h-4 w-4 text-purple-500" />;
    case "diplomatic": return <Users className="h-4 w-4 text-indigo-500" />;
    default: return <Bell className="h-4 w-4 text-gray-500" />;
  }
}

function getScopeLabel(notification: { userId: string | null; countryId: string | null }) {
  if (notification.userId) return { label: "User", icon: <Users className="h-3 w-3" /> };
  if (notification.countryId) return { label: "Country", icon: <Globe className="h-3 w-3" /> };
  return { label: "Global", icon: <Zap className="h-3 w-3" /> };
}

export function NotificationBrowser() {
  const notify = useNotify();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [readFilter, setReadFilter] = useState<string>("");
  const limit = 50;

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
        <div className="relative flex-1 min-w-[200px]">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder="Search title, description, message..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-8"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={readFilter} onValueChange={(v) => { setReadFilter(v); setPage(0); }}>
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

      {/* Table */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>
              {data ? `${data.totalCount} notification${data.totalCount !== 1 ? "s" : ""}` : "Loading..."}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[90px]">Type</TableHead>
                  <TableHead className="w-[80px]">Priority</TableHead>
                  <TableHead className="w-[70px]">Scope</TableHead>
                  <TableHead className="w-[60px]">Read</TableHead>
                  <TableHead className="w-[130px]">Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : data?.notifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No notifications found
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.notifications.map((n) => {
                    const scope = getScopeLabel(n);
                    return (
                      <TableRow key={n.id} className={!n.read ? "bg-accent/30" : ""}>
                        <TableCell>{getTypeIcon(n.type)}</TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="truncate font-medium text-sm">{n.title}</div>
                          {n.description && (
                            <div className="text-muted-foreground truncate text-xs">
                              {n.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {n.type || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              n.priority === "critical"
                                ? "destructive"
                                : n.priority === "high"
                                  ? "default"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {n.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {scope.icon}
                            <span className="ml-1">{scope.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {n.read ? (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-blue-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              deleteMutation.mutate({
                                notificationId: n.id,
                                adminUserId: "system-admin",
                              })
                            }
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
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
