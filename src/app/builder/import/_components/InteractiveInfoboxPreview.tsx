import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  WhiteFlag as Flag,
  MapPin,
  City as Building2,
  StatUp as TrendingUp,
  Group as Users,
  Globe,
  Clock,
  InfoCircle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
} from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { sanitizeWikiContent, formatNumber } from "~/lib/utils";
import type { UnifiedInfoboxData } from "~/lib/wiki-os/adapters/ixstates/unified-parser";

export interface LoreScanStatus {
  isScanning: boolean;
  pagesFound?: number;
  categoryUsed?: string | null;
  hasCompleted?: boolean;
}

interface InteractiveInfoboxPreviewProps {
  data: UnifiedInfoboxData & { wikiIntro?: string; categories?: string[] };
  onContinue: () => void;
  onBack?: () => void;
  isLoading?: boolean;
  loreScanStatus?: LoreScanStatus;
}

interface InfoboxSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: { label: string; value: string | undefined }[];
}

export const InteractiveInfoboxPreview: React.FC<InteractiveInfoboxPreviewProps> = ({
  data,
  onContinue,
  onBack,
  isLoading,
  loreScanStatus,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["keyinfo"])
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sections: InfoboxSection[] = [
    {
      id: "keyinfo",
      title: "Key Information",
      icon: InfoCircle,
      fields: [
        { label: "Population", value: data.population ? formatNumber(data.population) : undefined },
        { label: "GDP (Nominal)", value: data.GDP_nominal },
        { label: "GDP per Capita", value: data.GDP_nominal_per_capita },
        { label: "Capital", value: data.capital },
        { label: "Largest City", value: data.largest_city },
        { label: "Government Type", value: data.government_type },
        { label: "Head of State", value: data.head_of_state },
        { label: "Head of Government", value: data.head_of_government },
        { label: "Currency", value: data.currency },
        { label: "Official Languages", value: data.official_languages || data.languages },
        {
          label: "Area",
          value:
            data.area_total ||
            (data.area_km2 ? `${data.area_km2.toLocaleString()} km²` : undefined),
        },
        { label: "HDI", value: data.hdi },
        { label: "Established", value: data.established || data.established_date1 },
      ].filter((f) => f.value),
    },
    {
      id: "basic",
      title: "Basic Information",
      icon: Globe,
      fields: [
        { label: "Conventional Long Name", value: data.conventional_long_name },
        { label: "Official Name", value: data.official_name },
        { label: "Native Name", value: data.native_name },
        { label: "Demonym", value: data.demonym },
        { label: "Motto", value: data.motto },
        {
          label: "Population Estimate",
          value: data.population_estimate ? formatNumber(data.population_estimate) : undefined,
        },
        {
          label: "Population Census",
          value: data.population_census ? formatNumber(data.population_census) : undefined,
        },
      ].filter((f) => f.value),
    },
    {
      id: "geography",
      title: "Geography",
      icon: MapPin,
      fields: [
        { label: "Capital", value: data.capital },
        { label: "Largest City", value: data.largest_city },
        { label: "Continent", value: data.continent },
        {
          label: "Area",
          value:
            data.area_total ||
            (data.area_km2 ? `${data.area_km2.toLocaleString()} km²` : undefined),
        },
        { label: "Climate", value: data.climate },
      ].filter((f) => f.value),
    },
    {
      id: "government",
      title: "Government",
      icon: Building2,
      fields: [
        { label: "Government Type", value: data.government_type },
        { label: "Head of State", value: data.head_of_state },
        { label: "Head of Government", value: data.head_of_government },
        { label: "Legislature", value: data.legislature },
        { label: "Upper House", value: data.upper_house },
        { label: "Lower House", value: data.lower_house },
        {
          label: data.leader_title3 || "Leader",
          value: data.leader_name3,
        },
        {
          label: data.leader_title4 || "Leader",
          value: data.leader_name4,
        },
        { label: "Established", value: data.established || data.established_date1 },
        { label: "Independence", value: data.independence_date },
      ].filter((f) => f.value),
    },
    {
      id: "economy",
      title: "Economy",
      icon: TrendingUp,
      fields: [
        { label: "GDP (Nominal)", value: data.GDP_nominal },
        { label: "GDP (PPP)", value: data.GDP_PPP },
        { label: "GDP per Capita (Nominal)", value: data.GDP_nominal_per_capita },
        { label: "GDP per Capita (PPP)", value: data.GDP_PPP_per_capita },
        { label: "Currency", value: data.currency },
        { label: "Currency Code", value: data.currency_code },
        { label: "HDI", value: data.hdi },
      ].filter((f) => f.value),
    },
    {
      id: "culture",
      title: "Culture & Society",
      icon: Users,
      fields: [
        { label: "Official Languages", value: data.official_languages || data.languages },
        { label: "Ethnic Groups", value: data.ethnic_groups },
        { label: "Religion", value: data.religion },
        { label: "National Anthem", value: data.national_anthem },
        { label: "Demonym", value: data.demonym },
        { label: "Motto", value: data.motto },
      ].filter((f) => f.value),
    },
    {
      id: "technical",
      title: "Technical",
      icon: Clock,
      fields: [
        { label: "Time Zone", value: data.time_zone },
        { label: "Drives on", value: data.drives_on ? `${data.drives_on} side` : undefined },
        { label: "Calling Code", value: data.calling_code },
        { label: "Internet TLD", value: data.internet_tld },
        { label: "ISO Code", value: data.iso_code },
        { label: "Electricity", value: data.electricity },
      ].filter((f) => f.value),
    },
  ].filter((s) => s.fields.length > 0);

  const fieldCount = sections.reduce((sum, s) => sum + s.fields.length, 0);

  return (
    <Card className="bg-card/60 relative overflow-hidden border-blue-500/20 backdrop-blur-md">
      {/* Cinematic Background Flag Watermark Scrim (from MyCountry National Standing) */}
      {data.flagUrl && (
        <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 overflow-hidden opacity-[0.12] transition-opacity duration-300 select-none dark:opacity-[0.16]">
          <img
            src={data.flagUrl}
            alt=""
            className="h-full w-full rounded-full object-cover object-center mix-blend-luminosity blur-[1px] filter dark:mix-blend-normal"
          />
          <div className="via-card/75 to-card absolute inset-0 bg-gradient-to-l from-transparent" />
        </div>
      )}

      {/* Header */}
      <CardHeader className="relative z-10 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            {/* Back Button */}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-accent/40 active:scale-[0.97] cursor-pointer shrink-0 mt-0.5"
                title="Back to search"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}

            {/* Flag + Coat of Arms */}
            <div className="shrink-0 space-y-2">
              {data.flagUrl ? (
                <div className="border-border overflow-hidden rounded-lg border shadow-md">
                  <img
                    src={data.flagUrl}
                    alt={`Flag of ${data.name}`}
                    className="h-16 w-24 sm:h-20 sm:w-32 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="border-border bg-muted/50 flex h-16 w-24 sm:h-20 sm:w-32 items-center justify-center rounded-lg border">
                  <Flag className="text-muted-foreground h-8 w-8" />
                </div>
              )}
              {data.coatOfArmsUrl && (
                <div className="border-border overflow-hidden rounded-lg border shadow-sm">
                  <img
                    src={data.coatOfArmsUrl}
                    alt={`Coat of Arms of ${data.name}`}
                    className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Name + Info */}
            <div className="min-w-0 flex-1">
              <CardTitle className="mb-1 text-xl">{data.name}</CardTitle>
              {data.conventional_long_name && data.conventional_long_name !== data.name && (
                <p className="text-muted-foreground mb-2 text-sm">{data.conventional_long_name}</p>
              )}
              {data.government_type && (
                <Badge
                  variant="outline"
                  className="mb-2 border-blue-500/30 text-blue-600 dark:text-blue-400"
                >
                  {data.government_type}
                </Badge>
              )}
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{fieldCount} fields extracted</span>
                </span>
                {data.templateName && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-xs">{data.templateName}</span>
                  </>
                )}
              </div>

              {/* Background LoreScanner Status Pill */}
              {loreScanStatus && (
                <div className="mt-2.5 flex items-center gap-2">
                  {loreScanStatus.isScanning ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 backdrop-blur-md">
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                      <span>
                        LoreScanner: Checking Category:{loreScanStatus.categoryUsed || data.name} & subpages...
                      </span>
                    </div>
                  ) : loreScanStatus.hasCompleted ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 backdrop-blur-md">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      <span>
                        LoreScanner: Enriched {loreScanStatus.pagesFound ?? 0} subpages
                        {loreScanStatus.categoryUsed ? ` via Category:${loreScanStatus.categoryUsed}` : ""}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Continue Action */}
          <div className="shrink-0 flex sm:self-start">
            <Button
              size="default"
              className="group h-10 gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-600/35 active:scale-[0.96] cursor-pointer w-full sm:w-auto justify-center"
              onClick={onContinue}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Collapsible Sections */}
      <CardContent className="relative z-10 space-y-3 pb-6">
        {/* Wiki Intro Description */}
        {data.wikiIntro && (
          <div className="border-border/50 rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Description</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">{data.wikiIntro}</p>
          </div>
        )}

        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);

          return (
            <div key={section.id} className="border-border/50 overflow-hidden rounded-lg border">
              <button
                onClick={() => toggleSection(section.id)}
                className="hover:bg-muted/30 flex w-full items-center justify-between p-3 text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">{section.title}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 py-0 text-xs">
                    {section.fields.length}
                  </Badge>
                </div>
                {isExpanded ? (
                  <ChevronUp className="text-muted-foreground h-4 w-4" />
                ) : (
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 px-3 pb-3">
                      {section.fields.map((field, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 py-1">
                          <span className="text-muted-foreground shrink-0 text-sm">
                            {field.label}:
                          </span>
                          <span
                            className="text-right text-sm font-medium"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeWikiContent(field.value || ""),
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Bottom Actions: Back & Continue */}
        <div className="pt-4 flex items-center justify-between gap-4 border-t border-border/40">
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 gap-2 rounded-xl border-border/60 bg-muted/30 px-6 text-sm font-medium text-foreground transition-all hover:bg-accent/40 active:scale-[0.98] cursor-pointer"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          ) : <div />}

          <Button
            size="lg"
            className="group h-12 gap-2.5 rounded-xl bg-blue-600 px-8 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-600/35 active:scale-[0.98] cursor-pointer"
            onClick={onContinue}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <ArrowRight className="h-5 w-5 transition-transform duration-150 group-hover:translate-x-0.5" />
            )}
            <span>Continue</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
