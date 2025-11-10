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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
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
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  History,
  Filter,
  Eye,
  Sparkles,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useFlag } from "~/hooks/useFlag";
import { cn } from "~/lib/utils";

interface DiplomaticEventsHubProps {
  countryId: string;
  countryName: string;
}

// Event type configuration
const EVENT_TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  border_dispute: {
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Border Dispute",
  },
  trade_renegotiation: {
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    icon: <TrendingUp className="h-4 w-4" />,
    label: "Trade Negotiation",
  },
  cultural_misunderstanding: {
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
    icon: <MessageSquare className="h-4 w-4" />,
    label: "Cultural Issue",
  },
  intelligence_breach: {
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
    icon: <Eye className="h-4 w-4" />,
    label: "Intelligence Breach",
  },
  humanitarian_crisis: {
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Humanitarian Crisis",
  },
  alliance_pressure: {
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400",
    icon: <Sparkles className="h-4 w-4" />,
    label: "Alliance Pressure",
  },
  economic_sanctions_debate: {
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
    icon: <TrendingDown className="h-4 w-4" />,
    label: "Sanctions Debate",
  },
  technology_transfer_request: {
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400",
    icon: <Sparkles className="h-4 w-4" />,
    label: "Tech Transfer",
  },
  diplomatic_incident: {
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Diplomatic Incident",
  },
  mediation_opportunity: {
    color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Mediation Opportunity",
  },
  embassy_security_threat: {
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Security Threat",
  },
  treaty_renewal: {
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
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
        urgency === "critical" && "border-red-500 text-red-700 dark:text-red-400",
        urgency === "warning" && "border-yellow-500 text-yellow-700 dark:text-yellow-400",
        urgency === "normal" && "border-blue-500 text-blue-700 dark:text-blue-400"
      )}
    >
      <Clock className="h-3 w-3" />
      {timeLeft}
    </Badge>
  );
}

// Impact preview component
function ImpactPreview({ impact }: { impact: { relationship?: number; economic?: number; cultural?: number } }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
      {impact.relationship !== undefined && (
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-center gap-1 mb-1">
            {impact.relationship > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span
              className={cn(
                "font-bold",
                impact.relationship > 0 ? "text-green-600" : "text-red-600"
              )}
            >
              {impact.relationship > 0 ? "+" : ""}
              {impact.relationship}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Relationship</p>
        </div>
      )}
      {impact.economic !== undefined && (
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-center gap-1 mb-1">
            {impact.economic > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span
              className={cn(
                "font-bold",
                impact.economic > 0 ? "text-green-600" : "text-red-600"
              )}
            >
              {impact.economic > 0 ? "+" : ""}
              {impact.economic}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Economic</p>
        </div>
      )}
      {impact.cultural !== undefined && (
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-center gap-1 mb-1">
            {impact.cultural > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span
              className={cn(
                "font-bold",
                impact.cultural > 0 ? "text-green-600" : "text-red-600"
              )}
            >
              {impact.cultural > 0 ? "+" : ""}
              {impact.cultural}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Cultural</p>
        </div>
      )}
    </div>
  );
}

export function DiplomaticEventsHub({ countryId, countryName }: DiplomaticEventsHubProps) {
  const [activeTab, setActiveTab] = useState("active");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  // Fetch active scenarios
  const { data: activeData, isLoading: activeLoading, refetch: refetchActive } =
    api.diplomaticScenarios.getAllScenarios.useQuery({
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
  const activeScenarios = activeData?.scenarios || [];
  const scenarioHistory = historyData?.scenarios || [];

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
    return scenarioHistory.filter((s: any) => s.type === historyFilter);
  }, [scenarioHistory, historyFilter]);

  // Handle event response
  const handleResponse = (action: "accept" | "reject" | "negotiate") => {
    if (!selectedEvent) return;

    // Find the appropriate response option based on action
    const responseOptions = selectedEvent.responseOptions || [];
    let selectedOption = responseOptions[0]; // Default to first option

    if (action === "accept") {
      selectedOption = responseOptions.find((opt: any) =>
        opt.label?.toLowerCase().includes("accept") ||
        opt.label?.toLowerCase().includes("agree")
      ) || responseOptions[0];
    } else if (action === "reject") {
      selectedOption = responseOptions.find((opt: any) =>
        opt.label?.toLowerCase().includes("reject") ||
        opt.label?.toLowerCase().includes("decline")
      ) || responseOptions[1];
    } else if (action === "negotiate") {
      selectedOption = responseOptions.find((opt: any) =>
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
  const openResponseDialog = (event: any) => {
    setSelectedEvent(event);
    setIsResponseDialogOpen(true);
  };

  if (activeLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="space-y-4 text-center">
          <FileText className="mx-auto h-12 w-12 animate-pulse text-blue-600" />
          <p className="text-muted-foreground">Loading diplomatic events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="glass-hierarchy-child">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Active Events</p>
                <p className="text-3xl font-bold">{activeScenarios?.length || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Urgent Events</p>
                <p className="text-3xl font-bold">
                  {activeScenarios?.filter((s: any) => {
                    const hours = (new Date(s.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
                    return hours < 24;
                  }).length || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Resolved</p>
                <p className="text-3xl font-bold">{scenarioHistory?.length || 0}</p>
              </div>
              <History className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
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
              {activeScenarios.map((event: any) => {
                const eventConfig = EVENT_TYPE_CONFIG[event.type] || {
                  color: "bg-gray-100 text-gray-800",
                  icon: <FileText className="h-4 w-4" />,
                  label: event.type,
                };

                return (
                  <Card key={event.id} className="glass-hierarchy-child hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={eventConfig.color}>
                              {eventConfig.icon}
                              <span className="ml-1">{eventConfig.label}</span>
                            </Badge>
                            <EventCountdown expiresAt={event.expiresAt} />
                          </div>
                          <CardTitle className="text-lg">{event.title}</CardTitle>
                          {event.country2Name && (
                            <p className="text-sm text-muted-foreground mt-1">
                              with {event.country2Name}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                        {event.description}
                      </p>

                      {/* Quick Impact Preview */}
                      {event.responseOptions && event.responseOptions.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold mb-2">Potential Impacts:</p>
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
                          <Eye className="h-4 w-4 mr-2" />
                          View & Respond
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="glass-hierarchy-child">
              <CardContent className="flex min-h-[300px] items-center justify-center">
                <div className="text-center space-y-4">
                  <CheckCircle className="mx-auto h-16 w-16 text-green-600 opacity-50" />
                  <div>
                    <h3 className="text-lg font-semibold">No Active Events</h3>
                    <p className="text-muted-foreground text-sm mt-2">
                      You're all caught up! New diplomatic events will appear here.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Event History Tab */}
        <TabsContent value="history" className="space-y-4">
          {/* History Filter */}
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
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
            <Badge variant="outline">
              {filteredHistory.length} events
            </Badge>
          </div>

          {/* History List */}
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <History className="h-8 w-8 animate-pulse text-muted-foreground" />
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-3">
              {filteredHistory.map((event: any) => {
                const eventConfig = EVENT_TYPE_CONFIG[event.type] || {
                  color: "bg-gray-100 text-gray-800",
                  icon: <FileText className="h-4 w-4" />,
                  label: event.type,
                };

                return (
                  <Card key={event.id} className="glass-hierarchy-child">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={eventConfig.color}>
                              {eventConfig.icon}
                              <span className="ml-1 text-xs">{eventConfig.label}</span>
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {event.status}
                            </Badge>
                          </div>
                          <h4 className="font-semibold text-sm">{event.title}</h4>
                          {event.country2Name && (
                            <p className="text-xs text-muted-foreground">
                              with {event.country2Name}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {new Date(event.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="glass-hierarchy-child">
              <CardContent className="flex min-h-[200px] items-center justify-center">
                <div className="text-center space-y-2">
                  <History className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground text-sm">No event history found</p>
                </div>
              </CardContent>
            </Card>
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
                <h4 className="font-semibold mb-2">Situation</h4>
                <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
              </div>

              {/* Response Options */}
              {selectedEvent.responseOptions && selectedEvent.responseOptions.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Response Options</h4>
                  <div className="space-y-3">
                    {selectedEvent.responseOptions.map((option: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-medium">{option.label || `Option ${idx + 1}`}</h5>
                          <Badge variant="outline" className="text-xs">
                            {option.difficulty || "moderate"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {option.description || "No description available"}
                        </p>
                        <ImpactPreview
                          impact={{
                            relationship: option.relationshipEffect,
                            economic: option.economicImpact,
                            cultural: option.culturalImpact,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
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
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleResponse("negotiate")}
              disabled={respondMutation.isPending}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Negotiate
            </Button>
            <Button
              variant="default"
              onClick={() => handleResponse("accept")}
              disabled={respondMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
