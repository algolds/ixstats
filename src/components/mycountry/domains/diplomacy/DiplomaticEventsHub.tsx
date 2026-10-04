"use client";

import React, { useEffect, useState } from "react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "~/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Page as FileText,
  Clock,
  WarningCircle as AlertCircle,
  CheckCircle,
  XmarkCircle as XCircle,
  ChatBubble as MessageSquare,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  ClockRotateRight as History,
  Filter,
  Eye,
  Community,
  Cpu,
} from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

/** Fields this hub reads from a scenario's `responseOptions` (stored as untyped JSON). */
interface ScenarioResponseOption {
  id?: string;
  label?: string;
  description?: string;
  difficulty?: string;
  relationshipEffect?: number;
  economicImpact?: number;
  culturalImpact?: number;
}

type ScenarioRecord = RouterOutputs["diplomaticScenarios"]["getAllScenarios"]["scenarios"][number];
type DiplomaticEvent = Omit<ScenarioRecord, "responseOptions"> & {
  responseOptions: ScenarioResponseOption[];
};

interface DiplomaticEventsHubProps {
  countryId: string;
  countryName: string;
}

type IconComponent = React.ComponentType<{ className?: string }>;

const EVENT_TYPE_CONFIG: Record<string, { icon: IconComponent; label: string }> = {
  border_dispute: { icon: AlertCircle, label: "Border dispute" },
  trade_renegotiation: { icon: TrendingUp, label: "Trade negotiation" },
  cultural_misunderstanding: { icon: MessageSquare, label: "Cultural issue" },
  intelligence_breach: { icon: Eye, label: "Intelligence breach" },
  humanitarian_crisis: { icon: AlertCircle, label: "Humanitarian crisis" },
  alliance_pressure: { icon: Community, label: "Alliance pressure" },
  economic_sanctions_debate: { icon: TrendingDown, label: "Sanctions debate" },
  technology_transfer_request: { icon: Cpu, label: "Tech transfer" },
  diplomatic_incident: { icon: AlertCircle, label: "Diplomatic incident" },
  mediation_opportunity: { icon: CheckCircle, label: "Mediation opportunity" },
  embassy_security_threat: { icon: AlertCircle, label: "Security threat" },
  treaty_renewal: { icon: FileText, label: "Treaty renewal" },
};

const HISTORY_FILTERS = [
  ["all", "All events"],
  ["border_dispute", "Border disputes"],
  ["trade_renegotiation", "Trade negotiations"],
  ["cultural_misunderstanding", "Cultural issues"],
  ["alliance_pressure", "Alliance pressure"],
  ["treaty_renewal", "Treaty renewals"],
];

/** How each response button picks from a scenario's options: keywords in the label, else a fixed slot. */
const RESPONSE_MATCHERS = {
  accept: { words: ["accept", "agree"], fallbackIndex: 0 },
  reject: { words: ["reject", "decline"], fallbackIndex: 1 },
  negotiate: { words: ["negotiate", "counter"], fallbackIndex: 2 },
};
type ResponseAction = keyof typeof RESPONSE_MATCHERS;

const RESPONSE_BUTTONS: {
  action: ResponseAction;
  label: string;
  variant: "destructive" | "secondary" | "default";
  icon: IconComponent;
}[] = [
  { action: "reject", label: "Reject", variant: "destructive", icon: XCircle },
  { action: "negotiate", label: "Negotiate", variant: "secondary", icon: MessageSquare },
  { action: "accept", label: "Accept", variant: "default", icon: CheckCircle },
];

const HOUR_MS = 60 * 60 * 1000;

function eventTypeConfig(type: string) {
  return EVENT_TYPE_CONFIG[type] ?? { icon: FileText, label: type };
}

function EventTypeBadge({ type }: { type: string }) {
  const { icon: Icon, label } = eventTypeConfig(type);
  return (
    <Badge variant="outline">
      <Icon className="h-4 w-4" />
      {label}
    </Badge>
  );
}

const URGENCY_CLASS = {
  critical: "text-destructive",
  warning: "text-yellow",
  normal: "text-label-secondary",
};

function EventCountdown({ expiresAt }: { expiresAt: string | Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const diff = new Date(expiresAt).getTime() - now;
  const hours = Math.floor(diff / HOUR_MS);
  const days = Math.floor(hours / 24);
  const urgency = diff <= 0 ? "normal" : hours < 24 ? "critical" : days < 3 ? "warning" : "normal";

  return (
    <Badge variant="outline" className={cn("flex items-center gap-1", URGENCY_CLASS[urgency])}>
      <Clock className="h-3 w-3" />
      {diff <= 0 ? "Expired" : `${hours < 24 ? `${hours}h` : `${days}d`} remaining`}
    </Badge>
  );
}

function ImpactPreview({
  impact,
}: {
  impact: { relationship?: number; economic?: number; cultural?: number };
}) {
  const items = [
    { label: "Relationship", value: impact.relationship, suffix: "" },
    { label: "Economic", value: impact.economic, suffix: "%" },
    { label: "Cultural", value: impact.cultural, suffix: "%" },
  ].filter((i): i is { label: string; value: number; suffix: string } => i.value !== undefined);
  return (
    <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((item) => {
        const up = item.value > 0;
        const Trend = up ? TrendingUp : TrendingDown;
        return (
          <div key={item.label} className="bg-fill-3 rounded-control p-3 text-center">
            <dd
              className={cn(
                "mb-1 flex items-center justify-center gap-1 font-semibold tabular-nums",
                up ? "text-green" : "text-destructive"
              )}
            >
              <Trend className="h-4 w-4" />
              {up ? "+" : ""}
              {item.value}
              {item.suffix}
            </dd>
            <dt>
              <span className="text-stat-label text-label-secondary">{item.label}</span>
            </dt>
          </div>
        );
      })}
    </dl>
  );
}

function ActiveEventCard({ event, onOpen }: { event: DiplomaticEvent; onOpen: () => void }) {
  const first = event.responseOptions?.[0];
  return (
    <Card className="rounded-card">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <EventTypeBadge type={event.type} />
              <EventCountdown expiresAt={event.expiresAt} />
            </div>
            <h3 className="text-label text-title-3">{event.title}</h3>
            {event.country2Name && (
              <p className="text-label-secondary text-body mt-1">with {event.country2Name}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className="text-label-secondary text-body mb-4 line-clamp-3">{event.narrative}</p>

        {event.responseOptions && event.responseOptions.length > 0 && (
          <div className="mb-4">
            <Eyebrow>Potential impacts</Eyebrow>
            <ImpactPreview
              impact={{
                relationship: first?.relationshipEffect || 0,
                economic: first?.economicImpact || 0,
                cultural: first?.culturalImpact || 0,
              }}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="default" className="flex-1" onClick={onOpen}>
            <Eye className="h-4 w-4" />
            View & respond
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryEventRow({ event }: { event: DiplomaticEvent }) {
  return (
    <Card className="rounded-card p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <EventTypeBadge type={event.type} />
            <Badge variant="default" className="capitalize">
              {event.status}
            </Badge>
          </div>
          <h4 className="text-label text-headline">{event.title}</h4>
          {event.country2Name && (
            <p className="text-label-secondary text-footnote">with {event.country2Name}</p>
          )}
        </div>
        <div className="text-label-secondary text-footnote text-right">
          {new Date(event.resolvedAt ?? event.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Card>
  );
}

function EventResponseBody({ event }: { event: DiplomaticEvent }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-label text-headline mb-2">Situation</h4>
        <p className="text-label-secondary text-body">{event.narrative}</p>
      </div>

      {event.responseOptions && event.responseOptions.length > 0 && (
        <div>
          <h4 className="text-label text-headline mb-3">Response options</h4>
          <div className="space-y-3">
            {event.responseOptions.map((option, idx) => (
              <Card variant="well" key={idx} className="p-4">
                <div className="mb-2 flex items-start justify-between">
                  <h5 className="text-label text-body font-medium">
                    {option.label || `Option ${idx + 1}`}
                  </h5>
                  <Badge variant="outline" className="capitalize">
                    {option.difficulty || "moderate"}
                  </Badge>
                </div>
                <p className="text-label-secondary text-body mb-3">
                  {option.description || "No description available"}
                </p>
                <ImpactPreview
                  impact={{
                    relationship: option.relationshipEffect,
                    economic: option.economicImpact,
                    cultural: option.culturalImpact,
                  }}
                />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Picks the option a response button stands for: a keyword match in the label, else a fixed slot. */
function pickResponseOption(options: ScenarioResponseOption[], action: ResponseAction) {
  const { words, fallbackIndex } = RESPONSE_MATCHERS[action];
  return (
    options.find((opt) => words.some((w) => opt.label?.toLowerCase().includes(w))) ??
    options[fallbackIndex]
  );
}

export function DiplomaticEventsHub({ countryId }: DiplomaticEventsHubProps) {
  const [activeTab, setActiveTab] = useState("active");
  const [selectedEvent, setSelectedEvent] = useState<DiplomaticEvent | null>(null);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  const {
    data: activeData,
    isLoading: activeLoading,
    refetch: refetchActive,
  } = api.diplomaticScenarios.getAllScenarios.useQuery({
    isActive: true,
    country1Id: countryId,
    limit: 50,
  });

  const { data: historyData, isLoading: historyLoading } =
    api.diplomaticScenarios.getAllScenarios.useQuery({
      isActive: false,
      country1Id: countryId,
      limit: 100,
    });

  const activeScenarios: DiplomaticEvent[] = activeData?.scenarios || [];
  const scenarioHistory: DiplomaticEvent[] = historyData?.scenarios || [];
  const filteredHistory =
    historyFilter === "all"
      ? scenarioHistory
      : scenarioHistory.filter((s) => s.type === historyFilter);
  const urgentCount = activeScenarios.filter(
    (s) => new Date(s.expiresAt).getTime() - Date.now() < 24 * HOUR_MS
  ).length;

  const respondMutation = api.diplomaticScenarios.recordChoice.useMutation({
    onSuccess: () => {
      void refetchActive();
      setIsResponseDialogOpen(false);
      setSelectedEvent(null);
    },
  });

  const handleResponse = (action: ResponseAction) => {
    if (!selectedEvent) return;
    const selectedOption = pickResponseOption(selectedEvent.responseOptions || [], action);
    respondMutation.mutate({
      scenarioId: selectedEvent.id,
      countryId,
      choiceId: selectedOption?.id || "default",
      choiceLabel: selectedOption?.label || "Unknown Choice",
    });
  };

  if (activeLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading diplomatic events">
        <Skeleton className="rounded-card h-24" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="rounded-card h-56" />
          <Skeleton className="rounded-card h-56" />
        </div>
      </div>
    );
  }

  const SelectedIcon = selectedEvent && EVENT_TYPE_CONFIG[selectedEvent.type]?.icon;

  return (
    <div className="space-y-6">
      <Card className="rounded-card p-4">
        <dl className="grid grid-cols-3 gap-4">
          {[
            { label: "Active events", value: activeScenarios.length, icon: FileText },
            { label: "Urgent (<24h)", value: urgentCount, icon: Clock },
            { label: "Total resolved", value: scenarioHistory.length, icon: History },
          ].map((stat) => (
            <div key={stat.label} className="space-y-1">
              <dt>
                <Eyebrow className="flex items-center gap-2">
                  <stat.icon className="h-3.5 w-3.5" />
                  {stat.label}
                </Eyebrow>
              </dt>
              <dd className="text-label text-title-1 tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-fill-3 inline-flex flex-wrap gap-1 rounded-full p-1">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Active Events ({activeScenarios.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Event history
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeScenarios.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeScenarios.map((event) => (
                <ActiveEventCard
                  key={event.id}
                  event={event}
                  onOpen={() => {
                    setSelectedEvent(event);
                    setIsResponseDialogOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <Card className="rounded-card flex min-h-[240px] items-center justify-center p-6">
              <div className="space-y-3 text-center">
                <CheckCircle className="text-label-secondary mx-auto h-6 w-6" />
                <div>
                  <h3 className="text-label text-title-3">No active events</h3>
                  <p className="text-label-secondary text-body mt-1">
                    There are no diplomatic events to respond to.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-3">
            <Filter className="text-label-secondary h-4 w-4" />
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {HISTORY_FILTERS.map(([value, label]) => (
                  <SelectItem key={value} value={value!}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline">{filteredHistory.length} events</Badge>
          </div>

          {historyLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading event history">
              <Skeleton className="rounded-card h-20" />
              <Skeleton className="rounded-card h-20" />
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-3">
              {filteredHistory.map((event) => (
                <HistoryEventRow key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <Card className="rounded-card flex min-h-[200px] items-center justify-center p-6">
              <div className="space-y-2 text-center">
                <History className="text-label-secondary mx-auto h-6 w-6" />
                <p className="text-label-secondary text-body">No event history found</p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={isResponseDialogOpen} onOpenChange={setIsResponseDialogOpen}>
        <SheetContent size="wide" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {SelectedIcon && <SelectedIcon className="h-4 w-4" />}
              {selectedEvent?.title}
            </SheetTitle>
            <SheetDescription>
              {selectedEvent?.country2Name && `Diplomatic event with ${selectedEvent.country2Name}`}
            </SheetDescription>
          </SheetHeader>

          {selectedEvent && <EventResponseBody event={selectedEvent} />}

          <SheetFooter className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setIsResponseDialogOpen(false)}
              disabled={respondMutation.isPending}
            >
              Cancel
            </Button>
            {RESPONSE_BUTTONS.map(({ action, label, variant, icon: Icon }) => (
              <Button
                key={action}
                variant={variant}
                onClick={() => handleResponse(action)}
                disabled={respondMutation.isPending}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
