"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import {
  Clock,
  Calendar,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  TrendingUp,
  Zap,
  Info,
} from "lucide-react";
import { api } from "~/trpc/react";
import {
  getDelayDescription,
  getImpactColor,
  getImpactBgColor,
  type ChangeType,
  type ImpactLevel,
} from "~/lib/change-impact-calculator";
import { formatDistanceToNow, format } from "date-fns";

interface ScheduledChangesPanelProps {
  countryId?: string; // Optional - query uses user's country automatically
}

export function ScheduledChangesPanel({ countryId }: ScheduledChangesPanelProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  // Fetch pending changes (uses user's country automatically)
  const {
    data: pendingChanges,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = api.scheduledChanges.getPendingChanges.useQuery();

  // Fetch change history (uses user's country automatically)
  const {
    data: changeHistory,
    isLoading: historyLoading,
  } = api.scheduledChanges.getChangeHistory.useQuery(
    { limit: 20 },
    { enabled: activeTab === "history" }
  );

  // Cancel mutation
  const cancelMutation = api.scheduledChanges.cancelScheduledChange.useMutation({
    onSuccess: () => {
      void refetchPending();
    },
  });

  function handleCancelChange(changeId: string) {
    if (confirm("Are you sure you want to cancel this scheduled change?")) {
      cancelMutation.mutate({ changeId });
    }
  }

  function getChangeTypeIcon(changeType: string) {
    switch (changeType) {
      case "instant":
        return <Zap className="h-4 w-4 text-green-500" />;
      case "next_day":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "short_term":
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case "long_term":
        return <Calendar className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  }

  function formatValue(value: string): string {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "number") {
        return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
      return String(parsed);
    } catch {
      return value;
    }
  }

  function getFieldLabel(fieldPath: string): string {
    // Convert camelCase to Title Case
    return fieldPath
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  return (
    <Card className="glass-hierarchy-child sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-amber-500" />
          Scheduled Changes
        </CardTitle>
        <CardDescription>
          Track pending and past changes to your country
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "history")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending
              {pendingChanges && pendingChanges.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingChanges.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Pending Changes Tab */}
          <TabsContent value="pending" className="space-y-3 mt-4">
            {pendingLoading ? (
              <div className="space-y-2">
                <div className="h-20 bg-muted animate-pulse rounded-lg" />
                <div className="h-20 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : !pendingChanges || pendingChanges.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No pending changes. Edit your country data to schedule changes.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                <AnimatePresence>
                  {pendingChanges.map((change, index) => {
                    const warnings = change.warnings ? JSON.parse(change.warnings) as string[] : [];
                    const scheduledDate = new Date(change.scheduledFor);
                    const timeUntil = formatDistanceToNow(scheduledDate, { addSuffix: true });

                    return (
                      <motion.div
                        key={change.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        className={`rounded-lg border p-3 ${getImpactBgColor(change.impactLevel as ImpactLevel)}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            {getChangeTypeIcon(change.changeType)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {getFieldLabel(change.fieldPath)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatValue(change.oldValue)} → {formatValue(change.newValue)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelChange(change.id)}
                            disabled={cancelMutation.isPending}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${getImpactColor(change.impactLevel as ImpactLevel)}`}
                          >
                            {change.impactLevel} impact
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {timeUntil}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground mb-2">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Takes effect: {format(scheduledDate, "PPp")}
                        </p>

                        {warnings.length > 0 && (
                          <div className="mt-2 p-2 bg-background/50 rounded border border-amber-200 dark:border-amber-800">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Warnings:
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {warnings.slice(0, 2).map((warning, i) => (
                                <li key={i} className="flex gap-1">
                                  <span className="text-amber-500">•</span>
                                  <span>{warning}</span>
                                </li>
                              ))}
                              {warnings.length > 2 && (
                                <li className="text-xs italic">
                                  +{warnings.length - 2} more warnings
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-3 mt-4">
            {historyLoading ? (
              <div className="space-y-2">
                <div className="h-16 bg-muted animate-pulse rounded-lg" />
                <div className="h-16 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : !changeHistory || changeHistory.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No change history yet. Changes will appear here once they're applied.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {changeHistory.map((change) => {
                  const isApplied = change.status === "applied";
                  const isCancelled = change.status === "cancelled";
                  const statusDate = change.appliedAt || change.updatedAt;

                  return (
                    <div
                      key={change.id}
                      className="rounded-lg border p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          {isApplied ? (
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {getFieldLabel(change.fieldPath)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatValue(change.oldValue)} → {formatValue(change.newValue)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={isApplied ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {change.status}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {isApplied && "Applied "}
                        {isCancelled && "Cancelled "}
                        {formatDistanceToNow(statusDate, { addSuffix: true })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Summary Stats */}
        {pendingChanges && pendingChanges.length > 0 && activeTab === "pending" && (
          <>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">
                  {pendingChanges.length}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="p-2 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {pendingChanges.filter((c) => c.impactLevel === "high").length}
                </p>
                <p className="text-xs text-muted-foreground">High Impact</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
