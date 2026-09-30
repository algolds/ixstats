"use client";

/**
 * Diplomatic Events Hub Component
 *
 * Interactive diplomatic events management system featuring:
 * - Active events feed with scenario cards
 * - Event response system with action buttons
 * - Impact preview and outcome simulation
 * - Event history log with filtering
 * - Real-time countdown timers for urgent events
 *
 * @module DiplomaticEventsHub
 */

import React, { useState, useMemo, useEffect } from "react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
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

// Event type configuration
const EVENT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  border_dispute: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Border Dispute",
  },
  trade_renegotiation: {
    icon: <TrendingUp className="h-4 w-4" />,
    label: "Trade Negotiation",
  },
  cultural_misunderstanding: {
    icon: <MessageSquare className="h-4 w-4" />,
    label: "Cultural Issue",
  },
  intelligence_breach: {
    icon: <Eye className="h-4 w-4" />,
    label: "Intelligence Breach",
  },
  humanitarian_crisis: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Humanitarian Crisis",
  },
  alliance_pressure: {
    icon: <Community className="h-4 w-4" />,
    label: "Alliance Pressure",
  },
  economic_sanctions_debate: {
    icon: <TrendingDown className="h-4 w-4" />,
    label: "Sanctions Debate",
  },
  technology_transfer_request: {
    icon: <Cpu className="h-4 w-4" />,
    label: "Tech Transfer",
  },
  diplomatic_incident: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Diplomatic Incident",
  },
  mediation_opportunity: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Mediation Opportunity",
  },
  embassy_security_threat: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Security Threat",
  },
  treaty_renewal: {
    icon: <FileText className="h-4 w-4" />,
    label: "Treaty Renewal",
  },
};

// Countdown timer component
function EventCountdown({ expiresAt }: { expiresAt: string | Date }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgency, setUrgency] = useState<"critical" | "warning" | "normal">("normal");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);

      if (hours < 24) {
        setTimeLeft(`${hours}h remaining`);
        setUrgency("critical");
      } else if (days < 3) {
        setTimeLeft(`${days}d remaining`);
        setUrgency("warning");
      } else {
        setTimeLeft(`${days}d remaining`);
        setUrgency("normal");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1",
        urgency === "critical" && "text-destructive",
        urgency === "warning" && "text-amber-500",
        urgency === "normal" && "text-muted-foreground"
      )}
    >
      <Clock className="h-3 w-3" />
      {timeLeft}
    </Badge>
  );
}

// Impact preview component
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
          <div key={item.label} className="bg-muted/50 rounded-lg p-3 text-center">
            <dd
              className={cn(
                "mb-1 flex items-center justify-center gap-1 font-semibold tabular-nums",
                up ? "text-emerald-500" : "text-destructive"
              )}
            >
              <Trend className="h-4 w-4" />
              {up ? "+" : ""}
              {item.value}
              {item.suffix}
            </dd>
            <dt>
              <Eyebrow>{item.label}</Eyebrow>
            </dt>
          </div>
        );
      })}
    </dl>
  );
}

export function DiplomaticEventsHub({ countryId }: DiplomaticEventsHubProps) {
  const [activeTab, setActiveTab] = useState("active");
  const [selectedEvent, setSelectedEvent] = useState<DiplomaticEvent | null>(null);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  // Fetch active scenarios
  const {
    data: activeData,
    isLoading: activeLoading,
    refetch: refetchActive,
  } = api.diplomaticScenarios.getAllScenarios.useQuery({
    isActive: true,
    country1Id: countryId,
    limit: 50,
  });

  // Fetch scenario history (completed/expired)
  const { data: historyData, isLoading: historyLoading } =
    api.diplomaticScenarios.getAllScenarios.useQuery({
      isActive: false,
      country1Id: countryId,
      limit: 100,
    });

  // Extract scenarios from API response
  const activeScenarios: DiplomaticEvent[] = activeData?.scenarios || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scenarioHistory: DiplomaticEvent[] = historyData?.scenarios || [];

  // Response mutation
  const respondMutation = api.diplomaticScenarios.recordChoice.useMutation({
    onSuccess: () => {
      void refetchActive();
      setIsResponseDialogOpen(false);
      setSelectedEvent(null);
    },
  });

  // Filter history
  const filteredHistory = useMemo(() => {
    if (!scenarioHistory) return [];
    if (historyFilter === "all") return scenarioHistory;
    return scenarioHistory.filter((s) => s.type === historyFilter);
  }, [scenarioHistory, historyFilter]);

  // Handle event response
  const handleResponse = (action: "accept" | "reject" | "negotiate") => {
    if (!selectedEvent) return;

    // Find the appropriate response option based on action
    const responseOptions = selectedEvent.responseOptions || [];
    let selectedOption = responseOptions[0]; // Default to first option

    if (action === "accept") {
      selectedOption =
        responseOptions.find(
          (opt) =>
            opt.label?.toLowerCase().includes("accept") ||
            opt.label?.toLowerCase().includes("agree")
        ) || responseOptions[0];
    } else if (action === "reject") {
      selectedOption =
        responseOptions.find(
          (opt) =>
            opt.label?.toLowerCase().includes("reject") ||
            opt.label?.toLowerCase().includes("decline")
        ) || responseOptions[1];
    } else if (action === "negotiate") {
      selectedOption =
        responseOptions.find(
          (opt) =>
            opt.label?.toLowerCase().includes("negotiate") ||
            opt.label?.toLowerCase().includes("counter")
        ) || responseOptions[2];
    }

    respondMutation.mutate({
      scenarioId: selectedEvent.id,
      countryId: countryId,
      choiceId: selectedOption?.id || "default",
      choiceLabel: selectedOption?.label || "Unknown Choice",
    });
  };

  // Open response dialog
  const openResponseDialog = (event: DiplomaticEvent) => {
    setSelectedEvent(event);
    setIsResponseDialogOpen(true);
  };

  if (activeLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading diplomatic events">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <FacetCard depth={1} className="rounded-2xl p-4">
        <dl className="grid grid-cols-3 gap-4">
          {[
            { label: "Active events", value: activeScenarios?.length || 0, icon: FileText },
            {
              label: "Urgent (<24h)",
              value:
                activeScenarios?.filter((s) => {
                  const hours = (new Date(s.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
                  return hours < 24;
                }).length || 0,
              icon: Clock,
            },
            { label: "Total resolved", value: scenarioHistory?.length || 0, icon: History },
          ].map((stat) => (
            <div key={stat.label} className="space-y-1">
              <dt>
                <Eyebrow className="flex items-center gap-1.5">
                  <stat.icon className="h-3.5 w-3.5" />
                  {stat.label}
                </Eyebrow>
              </dt>
              <dd className="text-foreground text-2xl font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </FacetCard>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 inline-flex flex-wrap gap-1 rounded-full p-1">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Active Events ({activeScenarios?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Event History
          </TabsTrigger>
        </TabsList>

        {/* Active Events Tab */}
        <TabsContent value="active" className="space-y-4">
          {activeScenarios && activeScenarios.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeScenarios.map((event) => {
                const eventConfig = EVENT_TYPE_CONFIG[event.type] || {
                  icon: <FileText className="h-4 w-4" />,
                  label: event.type,
                };

                return (
                  <FacetCard key={event.id} depth={2} className="rounded-2xl">
                    <FacetCardHeader className="p-5 pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <Badge variant="outline">
                              {eventConfig.icon}
                              {eventConfig.label}
                            </Badge>
                            <EventCountdown expiresAt={event.expiresAt} />
                          </div>
                          <h3 className="text-foreground text-base font-semibold">{event.title}</h3>
                          {event.country2Name && (
                            <p className="text-muted-foreground mt-1 text-sm">
                              with {event.country2Name}
                            </p>
                          )}
                        </div>
                      </div>
                    </FacetCardHeader>
                    <FacetCardContent className="px-5 pb-5">
                      <p className="text-muted-foreground mb-4 line-clamp-3 text-sm">
                        {event.narrative}
                      </p>

                      {/* Quick Impact Preview */}
                      {event.responseOptions && event.responseOptions.length > 0 && (
                        <div className="mb-4">
                          <Eyebrow>Potential impacts</Eyebrow>
                          <ImpactPreview
                            impact={{
                              relationship: event.responseOptions[0]?.relationshipEffect || 0,
                              economic: event.responseOptions[0]?.economicImpact || 0,
                              cultural: event.responseOptions[0]?.culturalImpact || 0,
                            }}
                          />
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1"
                          onClick={() => openResponseDialog(event)}
                        >
                          <Eye className="h-4 w-4" />
                          View & Respond
                        </Button>
                      </div>
                    </FacetCardContent>
                  </FacetCard>
                );
              })}
            </div>
          ) : (
            <FacetCard
              depth={1}
              className="flex min-h-[240px] items-center justify-center rounded-2xl p-6"
            >
              <div className="space-y-3 text-center">
                <CheckCircle className="text-muted-foreground mx-auto h-6 w-6" />
                <div>
                  <h3 className="text-foreground text-base font-semibold">No active events</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    You&apos;re all caught up. New diplomatic events will appear here.
                  </p>
                </div>
              </div>
            </FacetCard>
          )}
        </TabsContent>

        {/* Event History Tab */}
        <TabsContent value="history" className="space-y-4">
          {/* History Filter */}
          <div className="flex items-center gap-3">
            <Filter className="text-muted-foreground h-4 w-4" />
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="border_dispute">Border Disputes</SelectItem>
                <SelectItem value="trade_renegotiation">Trade Negotiations</SelectItem>
                <SelectItem value="cultural_misunderstanding">Cultural Issues</SelectItem>
                <SelectItem value="alliance_pressure">Alliance Pressure</SelectItem>
                <SelectItem value="treaty_renewal">Treaty Renewals</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{filteredHistory.length} events</Badge>
          </div>

          {/* History List */}
          {historyLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading event history">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-3">
              {filteredHistory.map((event) => {
                const eventConfig = EVENT_TYPE_CONFIG[event.type] || {
                  icon: <FileText className="h-4 w-4" />,
                  label: event.type,
                };

                return (
                  <FacetCard key={event.id} depth={2} className="rounded-2xl p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="outline">
                            {eventConfig.icon}
                            {eventConfig.label}
                          </Badge>
                          <Badge variant="secondary" className="capitalize">
                            {event.status}
                          </Badge>
                        </div>
                        <h4 className="text-foreground text-sm font-semibold">{event.title}</h4>
                        {event.country2Name && (
                          <p className="text-muted-foreground text-xs">with {event.country2Name}</p>
                        )}
                      </div>
                      <div className="text-muted-foreground text-right text-xs">
                        {new Date(event.resolvedAt ?? event.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </FacetCard>
                );
              })}
            </div>
          ) : (
            <FacetCard
              depth={1}
              className="flex min-h-[200px] items-center justify-center rounded-2xl p-6"
            >
              <div className="space-y-2 text-center">
                <History className="text-muted-foreground mx-auto h-6 w-6" />
                <p className="text-muted-foreground text-sm">No event history found</p>
              </div>
            </FacetCard>
          )}
        </TabsContent>
      </Tabs>

      {/* Response Dialog */}
      <Dialog open={isResponseDialogOpen} onOpenChange={setIsResponseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && EVENT_TYPE_CONFIG[selectedEvent.type]?.icon}
              {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent?.country2Name && `Diplomatic event with ${selectedEvent.country2Name}`}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-6">
              {/* Event Details */}
              <div>
                <h4 className="text-foreground mb-2 text-sm font-semibold">Situation</h4>
                <p className="text-muted-foreground text-sm">{selectedEvent.narrative}</p>
              </div>

              {/* Response Options */}
              {selectedEvent.responseOptions && selectedEvent.responseOptions.length > 0 && (
                <div>
                  <h4 className="text-foreground mb-3 text-sm font-semibold">Response Options</h4>
                  <div className="space-y-3">
                    {selectedEvent.responseOptions.map((option, idx) => (
                      <FacetCard key={idx} surface="solid" className="rounded-xl p-4">
                        <div className="mb-2 flex items-start justify-between">
                          <h5 className="text-foreground text-sm font-medium">
                            {option.label || `Option ${idx + 1}`}
                          </h5>
                          <Badge variant="outline" className="capitalize">
                            {option.difficulty || "moderate"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-3 text-sm">
                          {option.description || "No description available"}
                        </p>
                        <ImpactPreview
                          impact={{
                            relationship: option.relationshipEffect,
                            economic: option.economicImpact,
                            cultural: option.culturalImpact,
                          }}
                        />
                      </FacetCard>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setIsResponseDialogOpen(false)}
              disabled={respondMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleResponse("reject")}
              disabled={respondMutation.isPending}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleResponse("negotiate")}
              disabled={respondMutation.isPending}
            >
              <MessageSquare className="h-4 w-4" />
              Negotiate
            </Button>
            <Button
              variant="default"
              onClick={() => handleResponse("accept")}
              disabled={respondMutation.isPending}
            >
              <CheckCircle className="h-4 w-4" />
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
