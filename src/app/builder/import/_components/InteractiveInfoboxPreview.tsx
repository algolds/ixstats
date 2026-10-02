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
import { FlagWatermark } from "~/components/ui/facet";
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["keyinfo"]));

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
    <Card className="relative overflow-hidden">
      <FlagWatermark src={data.flagUrl} />

      {/* Header */}
      <CardHeader className="relative z-10 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            {/* Back Button */}
            {onBack && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onBack}
                className="mt-0.5 shrink-0"
                title="Back to search"
                aria-label="Back to search"
              >
                <ArrowLeft aria-hidden />
                <span className="hidden sm:inline">Back</span>
              </Button>
            )}

            {/* Flag + Coat of Arms */}
            <div className="shrink-0 space-y-2">
              {data.flagUrl ? (
                <div className="border-separator rounded-control shadow-card overflow-hidden border">
                  <img
                    src={data.flagUrl}
                    alt={`Flag of ${data.name}`}
                    className="h-16 w-24 object-cover sm:h-20 sm:w-32"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="border-separator bg-fill-3 rounded-control flex h-16 w-24 items-center justify-center border sm:h-20 sm:w-32">
                  <Flag className="text-label-secondary h-8 w-8" />
                </div>
              )}
              {data.coatOfArmsUrl && (
                <div className="border-separator rounded-control shadow-card overflow-hidden border">
                  <img
                    src={data.coatOfArmsUrl}
                    alt={`Coat of Arms of ${data.name}`}
                    className="h-10 w-10 object-contain sm:h-12 sm:w-12"
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
              <CardTitle className="text-title-2 mb-1">{data.name}</CardTitle>
              {data.conventional_long_name && data.conventional_long_name !== data.name && (
                <p className="text-label-secondary text-body mb-2">{data.conventional_long_name}</p>
              )}
              {data.government_type && (
                <Badge variant="info" className="mb-2">
                  {data.government_type}
                </Badge>
              )}
              <div className="text-label-secondary text-body flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-2">
                  <CheckCircle className="text-green h-3.5 w-3.5" />
                  <span>{fieldCount} fields extracted</span>
                </span>
                {data.templateName && (
                  <>
                    <span>·</span>
                    <span className="text-footnote font-mono">{data.templateName}</span>
                  </>
                )}
              </div>

              {/* Background LoreScanner Status Pill */}
              {loreScanStatus && (
                <div className="mt-2 flex items-center gap-2">
                  {loreScanStatus.isScanning ? (
                    <div className="border-blue/30 bg-blue/10 text-caption text-blue inline-flex items-center gap-2 rounded-full border px-3 py-1">
                      <div className="bg-blue h-2 w-2 animate-ping rounded-full" />
                      <span>
                        LoreScanner: Checking Category:{loreScanStatus.categoryUsed || data.name} &
                        subpages...
                      </span>
                    </div>
                  ) : loreScanStatus.hasCompleted ? (
                    <div className="border-green/30 bg-green/10 text-caption text-green inline-flex items-center gap-2 rounded-full border px-3 py-1">
                      <CheckCircle className="text-green h-3.5 w-3.5" />
                      <span>
                        LoreScanner: Enriched {loreScanStatus.pagesFound ?? 0} subpages
                        {loreScanStatus.categoryUsed
                          ? ` via Category:${loreScanStatus.categoryUsed}`
                          : ""}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Continue Action */}
          <div className="flex shrink-0 sm:self-start">
            <Button
              size="default"
              className="group rounded-row bg-blue text-headline text-on-blue shadow-card hover:bg-blue h-10 w-full cursor-pointer justify-center gap-2 px-5 sm:w-auto"
              onClick={onContinue}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="border-separator border-t-separator h-4 w-4 animate-spin rounded-full border-2" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-[translate] duration-150 motion-safe:group-hover:translate-x-0.5 motion-safe:group-focus-visible:translate-x-0.5"
                  />
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
          <div className="border-separator rounded-control border p-4">
            <div className="mb-2 flex items-center gap-2">
              <Globe className="text-blue h-4 w-4" />
              <span className="text-body font-medium">Description</span>
            </div>
            <p className="text-label-secondary text-body leading-relaxed">{data.wikiIntro}</p>
          </div>
        )}

        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);

          return (
            <div
              key={section.id}
              className="border-separator rounded-control overflow-hidden border"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isExpanded}
                className="hover:bg-fill-4 focus-visible:outline-tint flex w-full items-center justify-between p-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <div className="flex items-center gap-2">
                  <Icon className="text-blue h-4 w-4" />
                  <span className="text-body font-medium">{section.title}</span>
                  <Badge variant="neutral" className="tabular-nums">
                    {section.fields.length}
                  </Badge>
                </div>
                {isExpanded ? (
                  <ChevronUp className="text-label-secondary h-4 w-4" />
                ) : (
                  <ChevronDown className="text-label-secondary h-4 w-4" />
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
                    <div className="space-y-2 px-3 pb-3">
                      {section.fields.map((field, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 py-1">
                          <span className="text-label-secondary text-body shrink-0">
                            {field.label}:
                          </span>
                          <span
                            className="text-body text-right font-medium"
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
        <div className="border-separator flex items-center justify-between gap-4 border-t pt-4">
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="rounded-row border-separator bg-fill-4 text-body text-label hover:bg-fill-3 h-12 cursor-pointer gap-2 px-6 font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          ) : (
            <div />
          )}

          <Button
            size="lg"
            className="group rounded-row bg-blue text-headline text-on-blue shadow-floating hover:bg-blue h-12 cursor-pointer gap-2 px-8"
            onClick={onContinue}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="border-separator border-t-separator h-5 w-5 animate-spin rounded-full border-2" />
            ) : (
              <ArrowRight
                aria-hidden="true"
                className="h-5 w-5 transition-[translate] duration-150 motion-safe:group-hover:translate-x-0.5 motion-safe:group-focus-visible:translate-x-0.5"
              />
            )}
            <span>Continue</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
