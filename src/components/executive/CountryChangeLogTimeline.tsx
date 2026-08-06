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
import { IxTime } from "~/lib/ixtime";

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

export function CountryChangeLogTimeline({
  countryId,
  countryName,
}: CountryChangeLogTimelineProps) {
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [filterCategory, setFilterCategory] = useState<"all" | "directives" | "diplomacy" | "politics">("all");
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

  const canonFeed = api.myCountryDashboard.getCanonFeed.useQuery(
    { countryId, limit: 30 },
    { enabled: !!countryId }
  );

  const groupedEvents = useMemo(() => {
    const groups: Record<string, GroupedEvent> = {};

    if (data?.logs) {
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
            prev =
              typeof log.previousValue === "string"
                ? JSON.parse(log.previousValue)
                : log.previousValue;
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
    }

    if (canonFeed.data?.items) {
      canonFeed.data.items.forEach((item: any) => {
        const key = `canon-${item.id}`;
        if (!groups[key]) {
          groups[key] = {
            id: item.id,
            sourceType: item.kind === "diplomacy" ? "diplomacy" : item.kind === "decision" ? "decision" : "policy",
            sourceId: item.id,
            appliedIxTime: item.timestamp,
            description: item.title,
            createdAt: new Date(item.timestamp),
            consequences: item.targetField
              ? [
                  {
                    targetModel: "simulation",
                    targetField: item.targetField,
                    previousValue: 0,
                    newValue: item.deltaValue ?? 0,
                    delta: item.deltaValue ?? 0,
                    description: `${item.targetField} adjustment`,
                  },
                ]
              : [],
          };
        }
      });
    }

    const allList = Object.values(groups).sort((a, b) => b.appliedIxTime - a.appliedIxTime);

    if (filterCategory === "directives") {
      return allList.filter((e) => ["policy", "decision", "intent"].includes(e.sourceType.toLowerCase())).slice(0, limit);
    }
    if (filterCategory === "diplomacy") {
      return allList.filter((e) => e.sourceType.toLowerCase() === "diplomacy").slice(0, limit);
    }
    if (filterCategory === "politics") {
      return allList.filter((e) => ["election", "politics", "government"].includes(e.sourceType.toLowerCase())).slice(0, limit);
    }

    return allList.slice(0, limit);
  }, [data, canonFeed.data, limit, filterCategory]);

  const hasMore = (data?.total ?? 0) > offset + limit;

  // appliedIxTime is an IxTime epoch (ms); some legacy rows stored seconds.
  const formatIxTime = (ixTime: number) => {
    // ponytail: rows < 1e12 were written in seconds, not ms — normalize
    const ms = ixTime < 1e12 ? ixTime * 1000 : ixTime;
    return IxTime.formatIxTime(ms);
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
      <div className="glass-hierarchy-child flex h-32 items-center justify-center rounded-xl">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="glass-panel relative mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 shadow-xl backdrop-blur-md">
      <div className="mb-6 flex flex-col gap-4 border-b border-white/15 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-xl font-bold tracking-tight">
            <History className="h-5 w-5 text-amber-400" />
            Recent Activity & Governance Ledger
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Integrated timeline of executive directives, policies, diplomatic events, and national activity.
          </p>
        </div>

        {/* Activity Feed Selectors */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {[
            { id: "all" as const, label: "All Activity" },
            { id: "directives" as const, label: "Directives & Policies" },
            { id: "diplomacy" as const, label: "Diplomacy" },
            { id: "politics" as const, label: "Elections & Cabinet" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterCategory(id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition-all cursor-pointer ${
                filterCategory === id
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground border border-white/10"
              }`}
            >
              {label}
            </button>
          ))}
          {isFetching && <Loader2 className="ml-1 h-4 w-4 animate-spin text-amber-400" />}
        </div>
      </div>

      {groupedEvents.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          No entries found in the national ledger yet.
        </div>
      ) : (
        <div className="relative max-h-[500px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent overflow-x-hidden overflow-y-auto pr-3 pl-8">
          <div className="relative space-y-8 border-l border-white/15 pl-6">
            {groupedEvents.map((event) => {
              const { eventName } = parseEventDetails(event);
              return (
                <div key={event.id} className="group relative">
                  {/* Timeline node dot */}
                  <div className="bg-background absolute top-1.5 -left-[35px] flex h-7.5 w-7.5 items-center justify-center rounded-full border border-white/15 shadow-md transition-transform group-hover:scale-110">
                    {getSourceIcon(event.sourceType)}
                  </div>

                  <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-amber-400/90">
                          {formatIxTime(event.appliedIxTime)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase ${getSourceBadgeColor(
                            event.sourceType
                          )}`}
                        >
                          {event.sourceType}
                        </span>
                      </div>
                      <h3 className="text-foreground text-sm font-semibold tracking-wide">
                        {eventName}
                      </h3>
                      <p className="text-muted-foreground max-w-xl text-xs">{event.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-1 border-white/15 text-xs hover:bg-white/10"
                        onClick={() => handleOpenProseModal(event)}
                      >
                        Generate Wikitext
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Consequences pills list */}
                  {event.consequences.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 pt-1">
                      {event.consequences.map((c, idx) => {
                        const isPositive = c.delta > 0;
                        const isClamped = c.description.toLowerCase().includes("clamped");
                        const clampMatch = c.description.match(/\[clamped from ([^\]]+)\]/);
                        const clampTooltip = clampMatch
                          ? `Clamped from ${clampMatch[1]}`
                          : undefined;
                        return (
                          <div
                            key={idx}
                            title={clampTooltip || c.description}
                            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all ${
                              isClamped
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                : isPositive
                                  ? "border-green-500/20 bg-green-500/10 text-green-400"
                                  : "border-red-500/20 bg-red-500/10 text-red-400"
                            }`}
                          >
                            {isClamped ? (
                              <span className="text-[10px] font-bold">⚠</span>
                            ) : isPositive ? (
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
                            {isClamped && (
                              <span className="font-sans text-[9px] opacity-75">(clamped)</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination controls */}
      {(hasMore || offset > 0) && (
        <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="border-white/15 hover:bg-white/10"
          >
            Previous
          </Button>
          <span className="text-muted-foreground font-mono text-xs">
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
      <Dialog
        open={selectedEvent !== null}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        <DialogContent className="text-foreground max-w-md border-white/15">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scroll className="h-5 w-5 text-amber-500" />
              Wiki Prose Generator
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Copy the wikitext below to post directly into the national wiki page.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted text-muted-foreground max-h-60 overflow-y-auto rounded-lg border border-white/10 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all">
            {generatedWikitext}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEvent(null)}
              className="text-muted-foreground hover:text-foreground border-white/10 hover:bg-white/10"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleCopyToClipboard}
              className="gap-1.5 bg-amber-600 font-medium text-white hover:bg-amber-700"
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
