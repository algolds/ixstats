"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TRIGGER_TYPES,
  CATEGORY_ORDER,
} from "~/lib/notifications/events-registry";
import {
  Search,
  Undo as RotateCcw,
  Filter,
  Activity,
  OffTag as Power,
  OffTag as PowerOff,
  Clock,
  StatsReport as BarChart3,
  Flash as Zap,
  Bell,
} from "iconoir-react";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_COLORS: Record<string, string> = {
  economic: "border-green/30 bg-green/10",
  diplomatic: "border-blue/30 bg-blue/10",
  governance: "border-purple/30 bg-purple/10",
  social: "border-pink/30 bg-pink/10",
  security: "border-red/30 bg-red/10",
  intelligence: "border-teal/30 bg-teal/10",
  crisis: "border-orange/30 bg-orange/10",
  achievement: "border-yellow/30 bg-yellow/10",
  system: "border-separator bg-fill-3",
};

const CATEGORY_LABELS: Record<string, string> = {
  economic: "Economic",
  diplomatic: "Diplomatic",
  governance: "Governance",
  social: "Social",
  security: "Security",
  intelligence: "Intelligence",
  crisis: "Crisis",
  achievement: "Achievement",
  system: "System",
};

export function EventsRegistryPanel() {
  const notify = useNotify();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");

  const utils = api.useUtils();

  const { data, isLoading, refetch } = api.notifications.getAllEvents.useQuery();
  const seedMutation = api.notifications.seedEvents.useMutation({
    onSuccess: (res) => {
      notify.success("Events seeded", `${res.created} created, ${res.skipped} already existed`);
      refetch();
    },
    onError: (e) => notify.error("Failed to seed events", e.message),
  });
  const toggleMutation = api.notifications.toggleEvent.useMutation({
    onSuccess: () => {
      utils.notifications.getAllEvents.invalidate();
    },
    onError: (e) => notify.error("Failed to toggle event", e.message),
  });
  const batchToggleMutation = api.notifications.batchToggleEvents.useMutation({
    onSuccess: (res) => {
      notify.success("Batch update", `${res.count} events updated`);
      utils.notifications.getAllEvents.invalidate();
    },
    onError: (e) => notify.error("Batch toggle failed", e.message),
  });

  const filtered = useMemo(() => {
    if (!data?.configs) return [];
    return data.configs
      .filter((c) => {
        if (
          search &&
          !c.name.toLowerCase().includes(search.toLowerCase()) &&
          !c.eventKey.toLowerCase().includes(search.toLowerCase()) &&
          !(c.description ?? "").toLowerCase().includes(search.toLowerCase())
        )
          return false;
        if (categoryFilter && c.category !== categoryFilter) return false;
        if (sourceFilter && c.source !== sourceFilter) return false;
        if (triggerFilter && c.triggerType !== triggerFilter) return false;
        if (statusFilter === "enabled" && !c.enabled) return false;
        if (statusFilter === "disabled" && c.enabled) return false;
        return true;
      })
      .sort((a, b) => {
        const ca = CATEGORY_ORDER[a.category] ?? 99;
        const cb = CATEGORY_ORDER[b.category] ?? 99;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      });
  }, [data, search, categoryFilter, sourceFilter, triggerFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [filtered]);

  const handleToggle = (eventKey: string, enabled: boolean) => {
    toggleMutation.mutate({ eventKey, enabled });
  };

  const uniqueSources = useMemo(
    () => [...new Set(data?.configs.map((c) => c.source).filter(Boolean) as string[])],
    [data]
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-label-secondary flex items-center gap-2">
            <Activity aria-hidden className="h-4 w-4" />
            Loading events...
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasConfigs = data && data.configs.length > 0;

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-label-secondary text-caption">Total Events</p>
                <p className="text-title-1">{data.total}</p>
              </div>
              <BarChart3 className="text-label-secondary h-6 w-6" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-caption text-green">Enabled</p>
                <p className="text-title-1 text-green">{data.enabled}</p>
              </div>
              <Power className="text-green h-6 w-6" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-caption text-red">Disabled</p>
                <p className="text-title-1 text-red">{data.disabled}</p>
              </div>
              <PowerOff className="text-red h-6 w-6" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-label-secondary text-caption">Categories</p>
                <p className="text-title-1">{new Set(data.configs.map((c) => c.category)).size}</p>
              </div>
              <Filter className="text-label-secondary h-6 w-6" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Seed / Batch controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!hasConfigs && (
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            variant="default"
          >
            <Zap className="mr-2 h-4 w-4" />
            {seedMutation.isPending ? "Seeding..." : "Seed Default Events"}
          </Button>
        )}
        {hasConfigs && (
          <>
            <Button
              onClick={() => batchToggleMutation.mutate({ enabled: true })}
              disabled={batchToggleMutation.isPending}
              variant="outline"
              size="sm"
            >
              <Power className="text-green mr-2 h-4 w-4" />
              Enable All
            </Button>
            <Button
              onClick={() => batchToggleMutation.mutate({ enabled: false })}
              disabled={batchToggleMutation.isPending}
              variant="outline"
              size="sm"
            >
              <PowerOff className="text-red mr-2 h-4 w-4" />
              Disable All
            </Button>
            <Button onClick={() => refetch()} variant="ghost" size="sm">
              <RotateCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </>
        )}
      </div>

      {hasConfigs && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <label className="text-label-secondary text-caption mb-1 block">Search</label>
                  <div className="relative">
                    <Search className="text-label-secondary absolute top-2.5 left-2.5 h-4 w-4" />
                    <Input
                      placeholder="Search events..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="w-[160px]">
                  <label className="text-label-secondary text-caption mb-1 block">Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">All Categories</SelectItem>
                      {NOTIFICATION_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat] ?? cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[160px]">
                  <label className="text-label-secondary text-caption mb-1 block">Source</label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">All Sources</SelectItem>
                      {uniqueSources.map((src) => (
                        <SelectItem key={src} value={src}>
                          {src}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[160px]">
                  <label className="text-label-secondary text-caption mb-1 block">
                    Trigger Type
                  </label>
                  <Select value={triggerFilter} onValueChange={setTriggerFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Triggers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">All Triggers</SelectItem>
                      {NOTIFICATION_TRIGGER_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[140px]">
                  <label className="text-label-secondary text-caption mb-1 block">Status</label>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-label-secondary text-footnote mt-2">
                {filtered.length} event{filtered.length !== 1 ? "s" : ""} found
              </p>
            </CardContent>
          </Card>

          {/* Event cards grouped by category */}
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([category, events]) => (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-title-3">{CATEGORY_LABELS[category] ?? category}</h3>
                  <Badge variant="outline">{events.length}</Badge>
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"

                      onClick={() => batchToggleMutation.mutate({ enabled: true, category })}
                      disabled={batchToggleMutation.isPending}
                    >
                      Enable all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"

                      onClick={() => batchToggleMutation.mutate({ enabled: false, category })}
                      disabled={batchToggleMutation.isPending}
                    >
                      Disable all
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {events.map((event) => (
                    <Card
                      key={event.id}
                      className={`border ${
                        CATEGORY_COLORS[event.category] ?? "border-separator bg-surface"
                      } ${!event.enabled ? "opacity-60" : ""}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-body truncate font-medium">{event.name}</h4>
                              <Badge
                                variant={event.enabled ? "default" : "secondary"}
                                className="h-5"
                              >
                                {event.enabled ? "ON" : "OFF"}
                              </Badge>
                            </div>
                            {event.description && (
                              <p className="text-label-secondary text-footnote mt-1 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <Switch
                            checked={event.enabled}
                            onCheckedChange={(checked) => handleToggle(event.eventKey, checked)}
                            disabled={toggleMutation.isPending}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Badge variant="outline">
                            <Bell className="mr-1 h-3 w-3" />
                            {event.category}
                          </Badge>
                          {event.source && <Badge variant="outline">{event.source}</Badge>}
                          {event.triggerType && (
                            <Badge variant="outline">{event.triggerType}</Badge>
                          )}
                        </div>

                        <div className="text-label-secondary text-footnote mt-2 flex items-center gap-3">
                          {event.lastTriggered ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(event.lastTriggered), {
                                addSuffix: true,
                              })}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Never triggered
                            </span>
                          )}
                          <span>{event.triggerCount} triggers</span>
                          <span className="text-footnote font-mono">{event.eventKey}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!isLoading && !hasConfigs && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12">
            <Bell className="text-label-secondary h-12 w-12" />
            <p className="text-label-secondary text-body">No notification events configured yet.</p>
            <p className="text-label-secondary text-footnote">
              Click "Seed Default Events" to populate from the registry.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
