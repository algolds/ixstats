"use client";

import { FacetCard } from "~/components/ui/facet-container";
import { FacetTabs } from "~/components/ui/facet";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React from "react";
import { Refresh as RefreshCw, MagicWand as Wand2 } from "iconoir-react";
import { cn } from "~/lib/utils";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";

import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type {
  LinkageValidationData,
  LinkageIssue,
  LinkageLinkedItem,
  LinkageUnlinkedItem,
} from "../types/editor-state";

const VALIDATION_TABS = [
  { id: "issues", label: "Issues" },
  { id: "linked", label: "Linked" },
  { id: "unlinked", label: "Unlinked" },
  { id: "features", label: "Features" },
];

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
  syncMutation: {
    isPending: boolean;
    mutate: (args: { action: "sync_all"; realm?: string }) => void;
  };
  autoMatchMutation: {
    isPending: boolean;
    mutate: (args: { action: "auto_match"; realm?: string }) => void;
  };
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
  const realm = useMapRealm();
  return (
    <div className="space-y-4 p-3 text-xs">
      <FacetCard surface="solid" className="flex items-center justify-between rounded-lg p-3">
        <div className="space-y-0.5">
          <Eyebrow className="block">Issues / Desyncs</Eyebrow>
          <span className="text-foreground text-xl font-bold">
            {validationData?.issues?.length ?? 0}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7"
            onClick={() => syncMutation.mutate({ action: "sync_all", realm })}
            disabled={syncMutation.isPending}
            title="Sync All Linked"
          >
            <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => autoMatchMutation.mutate({ action: "auto_match", realm })}
            disabled={autoMatchMutation.isPending}
            title="Auto-Match by Name"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        </div>
      </FacetCard>

      <FacetCard surface="solid" className="overflow-hidden rounded-lg">
        <div className="border-border border-b p-1.5">
          <FacetTabs
            tabs={VALIDATION_TABS}
            activeTab={validationTab}
            onChange={(tab) => setValidationTab(tab as typeof validationTab)}
            size="sm"
            tone="neutral"
            showTexture={false}
            className="w-full"
          />
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
                  className="border-border/30 bg-muted/10 hover:border-primary/40 hover:bg-primary/5 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.99]"
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
                  <span className="text-muted-foreground font-mono text-xs">
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
                  className="border-border/30 bg-muted/10 hover:border-primary/40 hover:bg-primary/5 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.99]"
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
                  <span className="text-muted-foreground font-mono text-xs">
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
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs leading-tight font-semibold",
                      item.hasGeometry
                        ? "border border-amber-500/30 text-amber-500"
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
                  className="bg-background border-border focus:ring-primary w-full rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
                />
                <select
                  value={featureFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFeatureFilter(e.target.value as "all" | "linked" | "unlinked")
                  }
                  className="bg-background border-border focus:ring-primary rounded border px-2 py-1 text-xs focus:ring-1 focus:outline-none"
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
                    className="border-border/30 bg-muted/10 hover:border-primary/40 hover:bg-primary/5 flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.99]"
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
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                        feat.isClaimed
                          ? "border border-emerald-500/30 text-emerald-500"
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
      </FacetCard>
    </div>
  );
});
