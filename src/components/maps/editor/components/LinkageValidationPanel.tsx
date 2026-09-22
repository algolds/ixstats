"use client";

import React from "react";
import { Refresh as RefreshCw, MagicWand as Wand2 } from "iconoir-react";
import { cn } from "~/lib/utils";

import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type {
  LinkageValidationData,
  LinkageIssue,
  LinkageLinkedItem,
  LinkageUnlinkedItem,
} from "../types/editor-state";

export interface LinkageFeatureItem {
  featureId: string;
  displayName: string;
  countryId?: string | null;
  fillColor?: string;
  centroidLng?: number;
  centroidLat?: number;
  isClaimed?: boolean;
}

interface LinkageValidationPanelProps {
  validationData?: LinkageValidationData | null;
  validationTab: "issues" | "linked" | "unlinked" | "features";
  setValidationTab: (tab: "issues" | "linked" | "unlinked" | "features") => void;
  featureSearch: string;
  setFeatureSearch: (s: string) => void;
  featureFilter: "all" | "linked" | "unlinked";
  setFeatureFilter: (f: "all" | "linked" | "unlinked") => void;
  filteredFeatures?: LinkageFeatureItem[];
  featureList?: LinkageFeatureItem[];
  syncMutation: { isPending: boolean; mutate: (args: { action: "sync_all" }) => void };
  autoMatchMutation: { isPending: boolean; mutate: (args: { action: "auto_match" }) => void };
  setActiveCountryId: (id: string | null) => void;
  setMapSelectedCountry: (country: SelectedCountry | null) => void;
}

export const LinkageValidationPanel = React.memo(function LinkageValidationPanel({
  validationData,
  validationTab,
  setValidationTab,
  featureSearch,
  setFeatureSearch,
  featureFilter,
  setFeatureFilter,
  filteredFeatures = [],
  featureList = [],
  syncMutation,
  autoMatchMutation,
  setActiveCountryId,
  setMapSelectedCountry,
}: LinkageValidationPanelProps) {
  return (
    <div className="space-y-4 p-3 text-xs">
      <div className="bg-muted/10 border-border/20 flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <span className="text-muted-foreground block text-[10px] font-semibold tracking-wider uppercase">
            Issues / Desyncs
          </span>
          <span className="text-foreground text-xl font-bold">
            {validationData?.issues?.length ?? 0}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => syncMutation.mutate({ action: "sync_all" })}
            disabled={syncMutation.isPending}
            className="rounded bg-primary/10 p-1.5 text-primary transition-colors hover:bg-primary/20 active:scale-[0.98]"
            title="Sync All Linked"
          >
            <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
          </button>
          <button
            onClick={() => autoMatchMutation.mutate({ action: "auto_match" })}
            disabled={autoMatchMutation.isPending}
            className="rounded bg-emerald-500/10 p-1.5 text-emerald-500 transition-colors hover:bg-emerald-500/20 active:scale-[0.98]"
            title="Auto-Match by Name"
          >
            <Wand2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-border/30 bg-card/40 overflow-hidden rounded-lg border">
        <div className="bg-muted/20 border-border/30 flex border-b text-[10px] font-semibold uppercase">
          <button
            onClick={() => setValidationTab("issues")}
            className={cn(
              "flex-1 border-b py-2 text-center transition-all active:scale-[0.98]",
              validationTab === "issues"
                ? "bg-primary/10 border-primary text-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Issues
          </button>
          <button
            onClick={() => setValidationTab("linked")}
            className={cn(
              "flex-1 border-b py-2 text-center transition-all active:scale-[0.98]",
              validationTab === "linked"
                ? "bg-primary/10 border-primary text-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Linked
          </button>
          <button
            onClick={() => setValidationTab("unlinked")}
            className={cn(
              "flex-1 border-b py-2 text-center transition-all active:scale-[0.98]",
              validationTab === "unlinked"
                ? "bg-primary/10 border-primary text-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Unlinked
          </button>
          <button
            onClick={() => setValidationTab("features")}
            className={cn(
              "flex-1 border-b py-2 text-center transition-all active:scale-[0.98]",
              validationTab === "features"
                ? "bg-primary/10 border-primary text-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Features
          </button>
        </div>

        <div className="max-h-[300px] space-y-1.5 overflow-y-auto p-3">
          {validationTab === "issues" &&
            validationData &&
            (!validationData.issues || validationData.issues.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center italic">
                No linkage issues found.
              </p>
            ) : (
              validationData.issues.map((item: LinkageIssue) => (
                <div
                  key={`${item.type}-${item.countryId}`}
                  onClick={() => {
                    setActiveCountryId(item.countryId);
                    setMapSelectedCountry({
                      featureId: item.featureId ?? "",
                      displayName: item.featureName ?? "",
                      fillColor: "#e8e5da",
                      centroidLng: 0,
                      centroidLat: 0,
                      countryId: item.countryId,
                    });
                  }}
                  className="border-border/30 bg-muted/10 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {item.countryFlag && (
                      <img
                        src={item.countryFlag}
                        alt=""
                        className="border-border/35 h-3.5 w-5 rounded border object-cover"
                      />
                    )}
                    <span className="text-foreground truncate font-medium">{item.countryName}</span>
                  </div>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {item.featureName}
                  </span>
                </div>
              ))
            ))}

          {validationTab === "linked" &&
            validationData &&
            (validationData.linked.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center italic">No linked features.</p>
            ) : (
              validationData.linked.map((item: LinkageLinkedItem) => (
                <div
                  key={item.featureId}
                  onClick={() => {
                    setActiveCountryId(item.countryId);
                    setMapSelectedCountry({
                      featureId: item.featureId,
                      displayName: item.featureName,
                      fillColor: "#e8e5da",
                      centroidLng: 0,
                      centroidLat: 0,
                      countryId: item.countryId,
                    });
                  }}
                  className="border-border/30 bg-muted/10 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {item.countryFlag && (
                      <img
                        src={item.countryFlag}
                        alt=""
                        className="border-border/35 h-3.5 w-5 rounded border object-cover"
                      />
                    )}
                    <span className="text-foreground truncate font-medium">{item.countryName}</span>
                  </div>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {item.featureName}
                  </span>
                </div>
              ))
            ))}

          {validationTab === "unlinked" &&
            validationData &&
            (validationData.unlinked.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center italic">All countries linked.</p>
            ) : (
              validationData.unlinked.map((item: LinkageUnlinkedItem) => (
                <div
                  key={item.countryId}
                  onClick={() => {
                    setActiveCountryId(item.countryId);
                    setMapSelectedCountry(null);
                  }}
                  className="border-border/30 bg-muted/10 flex items-center justify-between rounded-lg border p-2"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {item.countryFlag && (
                      <img
                        src={item.countryFlag}
                        alt=""
                        className="border-border/35 h-3.5 w-5 rounded border object-cover"
                      />
                    )}
                    <span className="text-foreground truncate font-medium">{item.countryName}</span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] leading-tight font-semibold",
                      item.hasGeometry
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.hasGeometry ? "Orphaned" : "No Geometry"}
                  </span>
                </div>
              ))
            ))}

          {validationTab === "features" && featureList && (
            <div className="space-y-2">
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="Search features..."
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                  className="bg-background border-border w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={featureFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFeatureFilter(e.target.value as "all" | "linked" | "unlinked")
                  }
                  className="bg-background border-border rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All</option>
                  <option value="linked">Linked</option>
                  <option value="unlinked">Unlinked</option>
                </select>
              </div>
              <div className="max-h-[160px] space-y-1 overflow-y-auto pr-0.5">
                {filteredFeatures.map((feat) => (
                  <div
                    key={feat.featureId}
                    onClick={() => {
                      setMapSelectedCountry({
                        featureId: feat.featureId,
                        displayName: feat.displayName ?? "",
                        fillColor: feat.fillColor ?? "#e8e5da",
                        centroidLng: feat.centroidLng ?? 0,
                        centroidLat: feat.centroidLat ?? 0,
                        countryId: feat.countryId ?? null,
                      });
                      if (feat.countryId) {
                        setActiveCountryId(feat.countryId);
                      } else {
                        setActiveCountryId(null);
                      }
                    }}
                    className="border-border/30 bg-muted/10 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <div
                        className="border-border/40 h-3 w-3 shrink-0 rounded-full border shadow-sm"
                        style={{ backgroundColor: feat.fillColor }}
                      />
                      <span className="text-foreground truncate font-medium">
                        {feat.displayName}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold",
                        feat.isClaimed
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {feat.isClaimed ? "Linked" : "Unlinked"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
