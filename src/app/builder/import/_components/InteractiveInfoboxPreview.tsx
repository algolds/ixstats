import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NavArrowDown as ChevronDown, NavArrowUp as ChevronUp, WhiteFlag as Flag, MapPin, City as Building2, StatUp as TrendingUp, Group as Users, Globe, Clock, Translate as Languages, Sparks as Sparkles } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { sanitizeWikiContent } from "~/lib/utils";
import type { UnifiedInfoboxData } from "~/lib/wiki-os/adapters/ixstates/unified-parser";

interface InteractiveInfoboxPreviewProps {
  data: UnifiedInfoboxData & { wikiIntro?: string };
  onContinue: () => void;
  isLoading?: boolean;
}

interface InfoboxSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: { label: string; value: string | undefined }[];
}

const formatNumber = (num: number | undefined): string => {
  if (!num) return "Unknown";
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
};

export const InteractiveInfoboxPreview: React.FC<InteractiveInfoboxPreviewProps> = ({
  data,
  onContinue,
  isLoading,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["basic", "geography", "government"])
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
      icon: Sparkles,
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
      {/* Flag Background */}
      {data.flagUrl && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={data.flagUrl}
            alt={`Flag of ${data.name}`}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-10 blur-3xl"
            style={{ filter: "blur(24px) saturate(0.7) brightness(0.5)", transform: "scale(1.2)" }}
          />
          <div className="from-card/90 via-card/95 to-card/90 absolute inset-0 bg-gradient-to-br backdrop-blur-sm" />
        </div>
      )}

      {/* Header */}
      <CardHeader className="relative z-10 pb-4">
        <div className="flex items-start gap-4">
          {/* Flag + Coat of Arms */}
          <div className="shrink-0 space-y-2">
            {data.flagUrl ? (
              <div className="border-border overflow-hidden rounded-lg border shadow-md">
                <img
                  src={data.flagUrl}
                  alt={`Flag of ${data.name}`}
                  className="h-20 w-32 object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="border-border bg-muted/50 flex h-20 w-32 items-center justify-center rounded-lg border">
                <Flag className="text-muted-foreground h-8 w-8" />
              </div>
            )}
            {data.coatOfArmsUrl && (
              <div className="border-border overflow-hidden rounded-lg border shadow-sm">
                <img
                  src={data.coatOfArmsUrl}
                  alt={`Coat of Arms of ${data.name}`}
                  className="h-12 w-12 object-contain"
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
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Sparkles className="h-3.5 w-3.5 text-green-500" />
              <span>{fieldCount} fields extracted</span>
              {data.templateName && (
                <>
                  <span>·</span>
                  <span className="font-mono text-xs">{data.templateName}</span>
                </>
              )}
            </div>
          </div>

          {/* Continue Button */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
              onClick={onContinue}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Use This Data
            </Button>
          </motion.div>
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

        {/* Raw Infobox Toggle */}
        {data.rawInfobox && Object.keys(data.rawInfobox).length > 0 && (
          <RawInfoboxToggle rawInfobox={data.rawInfobox} />
        )}
      </CardContent>
    </Card>
  );
};

function RawInfoboxToggle({ rawInfobox }: { rawInfobox: Record<string, string> }) {
  const [showRaw, setShowRaw] = useState(false);
  const entries = Object.entries(rawInfobox).slice(0, 20);

  return (
    <div className="border-border/50 overflow-hidden rounded-lg border">
      <button
        onClick={() => setShowRaw(!showRaw)}
        className="hover:bg-muted/30 flex w-full items-center justify-between p-3 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <Languages className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground text-sm font-medium">Raw Infobox Data</span>
          <Badge variant="outline" className="h-5 px-1.5 py-0 text-xs">
            {Object.keys(rawInfobox).length} fields
          </Badge>
        </div>
        {showRaw ? (
          <ChevronUp className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        )}
      </button>

      <AnimatePresence>
        {showRaw && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <div className="bg-muted/30 max-h-64 space-y-1 overflow-y-auto rounded-md p-3 font-mono text-xs">
                {entries.map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="shrink-0 text-blue-500">{key}:</span>
                    <span className="text-muted-foreground truncate">{value}</span>
                  </div>
                ))}
                {Object.keys(rawInfobox).length > 20 && (
                  <div className="text-muted-foreground border-border/50 border-t pt-1">
                    ... and {Object.keys(rawInfobox).length - 20} more fields
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
