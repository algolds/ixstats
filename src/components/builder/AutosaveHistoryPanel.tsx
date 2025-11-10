"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Check, X, Loader2, Clock, FileText, TrendingUp, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "~/lib/utils";

interface AutosaveHistoryPanelProps {
  countryId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

interface StatCardProps {
  label: string;
  value: string | number | null | undefined;
  icon?: React.ReactNode;
  className?: string;
}

function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <Card className={cn("flex-1", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">
              {value !== null && value !== undefined ? value : "-"}
            </p>
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

interface AutosaveItemProps {
  autosave: {
    id: string;
    action: string;
    timestamp: Date;
    details: string | null;
    error: string | null;
  };
}

function AutosaveItem({ autosave }: AutosaveItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isSuccess = !autosave.action.includes("_FAILED");

  let parsedDetails: Record<string, unknown> = {};
  try {
    parsedDetails = autosave.details ? JSON.parse(autosave.details) : {};
  } catch (error) {
    console.error("Failed to parse autosave details:", error);
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        isSuccess
          ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30"
          : "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSuccess ? (
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <X className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
          <div>
            <span className="font-medium">{getSectionName(autosave.action)}</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(autosave.timestamp))} ago</span>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? "Hide" : "View"} Details
        </Button>
      </div>

      {showDetails && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="text-sm">
            <p className="mb-2 font-medium">Changes:</p>
            <pre className="max-h-48 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
              {JSON.stringify(parsedDetails, null, 2)}
            </pre>
          </div>
          {autosave.error && (
            <div className="rounded bg-red-100 p-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-200">
              <p className="font-medium">Error:</p>
              <p className="mt-1">{autosave.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getSectionName(action: string): string {
  if (action.includes("IDENTITY")) return "National Identity";
  if (action.includes("GOVERNMENT")) return "Government";
  if (action.includes("TAX")) return "Tax System";
  if (action.includes("ECONOMY")) return "Economy";
  return "Unknown";
}

function getSectionFilter(section: string): string | undefined {
  if (section === "all") return undefined;
  return section.toUpperCase();
}

export function AutosaveHistoryPanel({
  countryId,
  isOpen = false,
  onClose,
}: AutosaveHistoryPanelProps) {
  const [selectedSection, setSelectedSection] = useState("all");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Fetch autosave stats
  const { data: stats, isLoading: statsLoading } = api.autosaveHistory.getAutosaveStats.useQuery(
    { countryId },
    { enabled: isOpen }
  );

  // Fetch autosave history with pagination
  const { data: historyData, isLoading: historyLoading } =
    api.autosaveHistory.getAutosaveHistory.useQuery(
      {
        countryId,
        limit,
        offset,
      },
      { enabled: isOpen }
    );

  // Filter autosaves by section on the client side
  const filteredAutosaves =
    selectedSection === "all"
      ? historyData?.autosaves ?? []
      : (historyData?.autosaves ?? []).filter((autosave) => {
          const sectionFilter = getSectionFilter(selectedSection);
          return sectionFilter ? autosave.action.includes(sectionFilter) : true;
        });

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
  };

  const handleSectionChange = (section: string) => {
    setSelectedSection(section);
    setOffset(0); // Reset pagination when changing sections
  };

  const successRate =
    stats?.totalAutosaves && stats.totalAutosaves > 0
      ? Math.round((stats.successCount / stats.totalAutosaves) * 100)
      : 0;

  const lastSaveText = stats?.lastAutosave
    ? formatDistanceToNow(new Date(stats.lastAutosave)) + " ago"
    : "Never";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Autosave History
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Total Saves"
            value={stats?.totalAutosaves ?? 0}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            label="Success Rate"
            value={`${successRate}%`}
            icon={<Check className="h-5 w-5" />}
            className={
              successRate >= 90
                ? "border-green-200 dark:border-green-800"
                : successRate >= 70
                  ? "border-yellow-200 dark:border-yellow-800"
                  : "border-red-200 dark:border-red-800"
            }
          />
          <StatCard
            label="Last Save"
            value={lastSaveText}
            icon={<Clock className="h-5 w-5" />}
          />
        </div>

        {/* Section Breakdown (if stats available) */}
        {stats && stats.totalAutosaves > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-medium">Section Breakdown</p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded bg-blue-50 p-2 dark:bg-blue-950/30">
                  <p className="text-muted-foreground">Identity</p>
                  <p className="text-lg font-bold">{stats.sectionBreakdown.identity}</p>
                </div>
                <div className="rounded bg-purple-50 p-2 dark:bg-purple-950/30">
                  <p className="text-muted-foreground">Government</p>
                  <p className="text-lg font-bold">{stats.sectionBreakdown.government}</p>
                </div>
                <div className="rounded bg-green-50 p-2 dark:bg-green-950/30">
                  <p className="text-muted-foreground">Tax</p>
                  <p className="text-lg font-bold">{stats.sectionBreakdown.tax}</p>
                </div>
                <div className="rounded bg-orange-50 p-2 dark:bg-orange-950/30">
                  <p className="text-muted-foreground">Economy</p>
                  <p className="text-lg font-bold">{stats.sectionBreakdown.economy}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Filter */}
        <Tabs value={selectedSection} onValueChange={handleSectionChange}>
          <TabsList className="w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="government">Government</TabsTrigger>
            <TabsTrigger value="tax">Tax</TabsTrigger>
            <TabsTrigger value="economy">Economy</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Timeline */}
        <div className="space-y-3">
          {statsLoading || historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAutosaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="mb-2 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {selectedSection === "all"
                  ? "No autosaves found"
                  : `No ${selectedSection} autosaves found`}
              </p>
            </div>
          ) : (
            filteredAutosaves.map((autosave) => (
              <AutosaveItem key={autosave.id} autosave={autosave} />
            ))
          )}
        </div>

        {/* Load More */}
        {historyData?.hasMore && selectedSection === "all" && (
          <div className="flex justify-center pt-2">
            <Button onClick={handleLoadMore} variant="outline" disabled={historyLoading}>
              {historyLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
