"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import {
  Scroll,
  Gavel,
  Mail,
  Vote,
  History,
  Clipboard,
  Check,
  Loader2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { WikiProseGenerator } from "~/lib/wiki-prose-generator";

interface CountryChangeLogTimelineProps {
  countryId: string;
  countryName: string;
}

interface GroupedEvent {
  id: string;
  sourceType: string;
  sourceId: string | null;
  appliedIxTime: number;
  description: string;
  createdAt: Date;
  consequences: Array<{
    targetModel: string;
    targetField: string;
    previousValue: number;
    newValue: number;
    delta: number;
    description: string;
  }>;
}

export function CountryChangeLogTimeline({ countryId, countryName }: CountryChangeLogTimelineProps) {
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<GroupedEvent | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isFetching } = api.countries.getChangeLogs.useQuery(
    {
      countryId,
      limit: limit + 5, // fetch slightly more to detect if there is a next page
      offset,
    },
    { enabled: !!countryId }
  );

  const groupedEvents = useMemo(() => {
    if (!data?.logs) return [];

    const groups: Record<string, GroupedEvent> = {};

    data.logs.forEach((log: any) => {
      // Unique group key: group by sourceType + sourceId + appliedIxTime.
      // If sourceId is null, group by sourceType + description + appliedIxTime.
      const groupKey = log.sourceId
        ? `${log.sourceType}-${log.sourceId}-${log.appliedIxTime}`
        : `${log.sourceType}-${log.description}-${log.appliedIxTime}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: log.id,
          sourceType: log.sourceType,
          sourceId: log.sourceId,
          appliedIxTime: log.appliedIxTime,
          description: log.description || "",
          createdAt: new Date(log.createdAt),
          consequences: [],
        };
      }

      if (log.targetField) {
        let prev = 0;
        let next = 0;
        try {
          prev = typeof log.previousValue === "string" ? JSON.parse(log.previousValue) : log.previousValue;
          next = typeof log.newValue === "string" ? JSON.parse(log.newValue) : log.newValue;
        } catch {
          prev = Number(log.previousValue) || 0;
          next = Number(log.newValue) || 0;
        }

        groups[groupKey]!.consequences.push({
          targetModel: log.targetModel || "",
          targetField: log.targetField,
          previousValue: prev,
          newValue: next,
          delta: log.deltaValue ?? 0,
          description: log.description || "",
        });
      }
    });

    // Take only the limit number of items, sorting by appliedIxTime descending
    return Object.values(groups)
      .sort((a, b) => b.appliedIxTime - a.appliedIxTime)
      .slice(0, limit);
  }, [data, limit]);

  const hasMore = (data?.total ?? 0) > offset + limit;

  // Format IxTime to standard year & month representations
  const formatIxTime = (ixTime: number) => {
    const year = Math.floor(ixTime / 12) + 2041;
    const month = (Math.floor(ixTime) % 12) + 1;
    const monthName = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ][month - 1];
    return `${monthName} ${year}`;
  };

  const getSourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "policy":
        return <Scroll className="h-4 w-4 text-emerald-500" />;
      case "decision":
        return <Gavel className="h-4 w-4 text-amber-500" />;
      case "diplomacy":
        return <Mail className="h-4 w-4 text-sky-500" />;
      case "election":
        return <Vote className="h-4 w-4 text-indigo-500" />;
      default:
        return <History className="h-4 w-4 text-slate-400" />;
    }
  };

  const getSourceBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "policy":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
      case "decision":
        return "border-amber-500/20 bg-amber-500/10 text-amber-400";
      case "diplomacy":
        return "border-sky-500/20 bg-sky-500/10 text-sky-400";
      case "election":
        return "border-indigo-500/20 bg-indigo-500/10 text-indigo-400";
      default:
        return "border-slate-500/20 bg-slate-500/10 text-slate-400";
    }
  };

  // Parses clean title and details from descriptive strings
  const parseEventDetails = (event: GroupedEvent) => {
    let eventName = "National Event";
    let detailsText = "";
    const description = event.description;

    const quoteMatch = description.match(/"([^"]+)"/);
    if (quoteMatch) {
      eventName = quoteMatch[1]!;
      detailsText = description.replace(quoteMatch[0], "").trim();
      if (detailsText.startsWith(":") || detailsText.startsWith("-")) {
        detailsText = detailsText.substring(1).trim();
      }
    } else {
      const parts = description.split(":");
      if (parts.length > 1) {
        eventName = parts[0]!.trim();
        detailsText = parts.slice(1).join(":").trim();
      } else {
        eventName = description;
      }
    }

    if (event.sourceType === "policy") {
      eventName = eventName.replace(/^Enacted policy\s+/i, "");
    } else if (event.sourceType === "decision") {
      eventName = eventName.replace(/^Implemented decision\s+/i, "");
    }

    return { eventName, detailsText };
  };

  const handleOpenProseModal = (event: GroupedEvent) => {
    setSelectedEvent(event);
    setCopied(false);
  };

  const generatedWikitext = useMemo(() => {
    if (!selectedEvent) return "";

    const { eventName, detailsText } = parseEventDetails(selectedEvent);

    return WikiProseGenerator.generate(selectedEvent.sourceType, {
      countryName,
      eventName,
      details: detailsText || undefined,
      consequences: selectedEvent.consequences.map((c) => ({
        targetField: c.targetField,
        delta: c.delta,
      })),
    });
  }, [selectedEvent, countryName]);

  const handleCopyToClipboard = () => {
    if (!generatedWikitext) return;
    navigator.clipboard.writeText(generatedWikitext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading && offset === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="glass-panel relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 shadow-xl backdrop-blur-md mt-6">
      <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <History className="h-5 w-5 text-amber-400" />
            National Ledger & Timeline
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Historical ledger of executive decisions, issues, policy changes, and simulation updates.
          </p>
        </div>
        {isFetching && (
          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
        )}
      </div>

      {groupedEvents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No entries found in the national ledger yet.
        </div>
      ) : (
        <div className="relative pl-6 border-l border-white/15 space-y-8 ml-2">
          {groupedEvents.map((event) => {
            const { eventName } = parseEventDetails(event);
            return (
              <div key={event.id} className="relative group">
                {/* Timeline node dot */}
                <div className="absolute -left-[35px] top-1.5 flex h-7.5 w-7.5 items-center justify-center rounded-full border border-white/15 bg-[#161618] shadow-md transition-transform group-hover:scale-110">
                  {getSourceIcon(event.sourceType)}
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-amber-400/90 font-mono">
                        {formatIxTime(event.appliedIxTime)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getSourceBadgeColor(
                          event.sourceType
                        )}`}
                      >
                        {event.sourceType}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">
                      {eventName}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-xl">
                      {event.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/15 hover:bg-white/10 text-xs gap-1 cursor-pointer"
                      onClick={() => handleOpenProseModal(event)}
                    >
                      Generate Wikitext
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Consequences pills list */}
                {event.consequences.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 pt-1">
                    {event.consequences.map((c, idx) => {
                      const isPositive = c.delta > 0;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                            isPositive
                              ? "bg-green-500/10 border-green-500/20 text-green-400"
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="capitalize">
                            {c.targetField.replace(/([A-Z])/g, " $1").trim()}:
                          </span>
                          <span className="font-mono">
                            {isPositive ? "+" : ""}
                            {c.delta.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {(hasMore || offset > 0) && (
        <div className="flex items-center justify-between border-t border-white/15 pt-4 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="border-white/15 hover:bg-white/10"
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            Page {Math.floor(offset / limit) + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => setOffset(offset + limit)}
            className="border-white/15 hover:bg-white/10"
          >
            Next
          </Button>
        </div>
      )}

      {/* Wikitext Prose Dialog Modal */}
      <Dialog open={selectedEvent !== null} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-md border-white/15 bg-[#1a1a1e] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scroll className="h-5 w-5 text-amber-500" />
              Wiki Prose Generator
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Copy the wikitext below to post directly into the national wiki page.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-[#101012] border border-white/10 rounded-lg p-3 text-xs font-mono leading-relaxed select-all whitespace-pre-wrap max-h-60 overflow-y-auto text-slate-300">
            {generatedWikitext}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEvent(null)}
              className="border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleCopyToClipboard}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Clipboard className="h-4 w-4" />
                  Copy Wikitext
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
