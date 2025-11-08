"use client";

import React from "react";
import { X, Crown, TrendingUp, Users, Activity } from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { createAbsoluteUrl } from "~/lib/url-utils";

interface MyCountryExpandedViewProps {
  section: "overview" | "executive" | "diplomacy" | "intelligence" | "defense";
  quickActions: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
  }>;
  vitals: Array<{
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }>;
  countryData: {
    name: string;
    slug?: string;
  };
  onClose: () => void;
}

export function MyCountryExpandedView({
  section,
  quickActions,
  vitals,
  countryData,
  onClose,
}: MyCountryExpandedViewProps) {
  return (
    <div className="absolute top-full left-1/2 z-[10002] mt-2 w-[95vw] max-w-2xl -translate-x-1/2 transform">
      <div
        className="command-palette-dropdown border-border relative mx-auto w-full overflow-hidden rounded-xl shadow-2xl dark:border-white/10"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.05) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        {/* Refraction border effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-amber-400/30 to-transparent" />
          <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-amber-400/20 to-transparent" />
        </div>

        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-bold text-foreground">MyCountry® Command</h3>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 h-8 w-8 rounded-full p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="mb-4">
            <Tabs value={section} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger
                  value="overview"
                  onClick={() => (window.location.href = createAbsoluteUrl("/mycountry"))}
                  className="text-xs"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="executive"
                  onClick={() =>
                    (window.location.href = createAbsoluteUrl("/mycountry/executive"))
                  }
                  className="text-xs"
                >
                  Executive
                </TabsTrigger>
                <TabsTrigger
                  value="diplomacy"
                  onClick={() =>
                    (window.location.href = createAbsoluteUrl("/mycountry/diplomacy"))
                  }
                  className="text-xs"
                >
                  Diplomacy
                </TabsTrigger>
                <TabsTrigger
                  value="intelligence"
                  onClick={() =>
                    (window.location.href = createAbsoluteUrl("/mycountry/intelligence"))
                  }
                  className="text-xs"
                >
                  Intelligence
                </TabsTrigger>
                <TabsTrigger
                  value="defense"
                  onClick={() =>
                    (window.location.href = createAbsoluteUrl("/mycountry/defense"))
                  }
                  className="text-xs"
                >
                  Defense
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Quick Actions */}
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Quick Actions</div>
            <div className="grid grid-cols-3 gap-2">
              {quickActions.map((action, index) => {
                const ActionIcon = action.icon;
                return (
                  <Button
                    key={index}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const href = action.href.replace(
                        "{slug}",
                        countryData.slug || countryData.name.toLowerCase().replace(/\s+/g, "-")
                      );
                      window.location.href = createAbsoluteUrl(href);
                    }}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-amber-500/10"
                  >
                    <ActionIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <span className="text-[11px] text-center">{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* All Vitals Display */}
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Country Vitals</div>
            <div className="grid grid-cols-4 gap-2">
              {vitals.map((vital, index) => {
                const VIcon = vital.icon;
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-amber-400/20 bg-card/50 p-3 transition-all hover:border-amber-400/40 hover:bg-amber-500/5"
                  >
                    <VIcon className={`h-5 w-5 ${vital.color}`} />
                    <span className="text-[10px] font-medium text-foreground/60">
                      {vital.label}
                    </span>
                    <span className={`text-sm font-bold ${vital.color}`}>{vital.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
