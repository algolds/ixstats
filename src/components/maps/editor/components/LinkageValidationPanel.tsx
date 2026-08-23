"use client";

import React from "react";
import { Refresh as RefreshCw, MagicWand as Wand2 } from "iconoir-react";
import { cn } from "~/lib/utils";

interface LinkageValidationPanelProps {
  validationData: any;
  validationTab: "issues" | "linked" | "unlinked" | "features";
  setValidationTab: (tab: "issues" | "linked" | "unlinked" | "features") => void;
  featureSearch: string;
  setFeatureSearch: (s: string) => void;
  featureFilter: "all" | "linked" | "unlinked";
  setFeatureFilter: (f: "all" | "linked" | "unlinked") => void;
  filteredFeatures: any[];
  featureList: any[];
  syncMutation: any;
  autoMatchMutation: any;
  setActiveCountryId: (id: string | null) => void;
  setMapSelectedCountry: (country: any | null) => void;
}

export function LinkageValidationPanel({
  validationData,
  validationTab,
  setValidationTab,
  featureSearch,
  setFeatureSearch,
  featureFilter,
  setFeatureFilter,
  filteredFeatures,
  featureList,
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
            className="rounded bg-blue-600/10 p-1.5 text-blue-500 transition-colors hover:bg-blue-600/20"
            title="Sync All Linked"
          >
            <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
          </button>
          <button
            onClick={() => autoMatchMutation.mutate({ action: "auto_match" })}
            disabled={autoMatchMutation.isPending}
            className="rounded bg-emerald-600/10 p-1.5 text-emerald-500 transition-colors hover:bg-emerald-600/20"
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
              "flex-1 border-b py-2 text-center transition-all",
              validationTab === "issues"
                ? "bg-muted/10 border-blue-500 text-blue-500"
                : "text-muted-foreground border-transparent"
            )}
          >
            Issues
          </button>
          <button
            onClick={() => setValidationTab("linked")}
            className={cn(
              "flex-1 border-b py-2 text-center transition-all",
              validationTab === "linked"
                ? "bg-muted/10 border-blue-500 text-blue-500"
                : "text-muted-foreground border-transparent"
            )}
          >
            Linked
          </button>
          <button
            onClick={() => setValidationTab("unlinked")}
            className={cn(
              "flex-1 border-b py-2 text-center transition-all",
              validationTab === "unlinked"
                ? "bg-muted/10 border-blue-500 text-blue-500"
                : "text-muted-foreground border-transparent"
            )}
          >
            Unlinked
          </button>
          <button
            onClick={() => setValidationTab("features")}
            className={cn(
              "flex-1 border-b py-2 text-center transition-all",
              validationTab === "features"
                ? "bg-muted/10 border-blue-500 text-blue-500"
                : "text-muted-foreground border-transparent"
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
              validationData.issues.map((item: any) => (
                <div
                  key={`${item.type}-${item.countryId}`}
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
                  className="border-border/30 bg-muted/10 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-all hover:border-blue-500/40 hover:bg-blue-500/5"
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
              validationData.linked.map((item: any) => (
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
                  className="border-border/30 bg-muted/10 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-all hover:border-blue-500/40 hover:bg-blue-500/5"
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
              validationData.unlinked.map((item: any) => (
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
                  className="bg-background border-border w-full rounded border px-2 py-1 text-xs"
                />
                <select
                  value={featureFilter}
                  onChange={(e: any) => setFeatureFilter(e.target.value)}
                  className="bg-background border-border rounded border px-2 py-1 text-xs"
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
                        displayName: feat.displayName,
                        fillColor: feat.fillColor,
                        centroidLng: feat.centroidLng,
                        centroidLat: feat.centroidLat,
                        countryId: feat.countryId,
                      });
                      if (feat.countryId) {
                        setActiveCountryId(feat.countryId);
                      } else {
                        setActiveCountryId(null);
                      }
                    }}
                    className="border-border/30 bg-muted/10 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-all hover:border-blue-500/40 hover:bg-blue-500/5"
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
}
