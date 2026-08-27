"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Xmark as X,
  MapPin,
  Group as Users,
  StatUp as TrendingUp,
  City as Building2,
  Shield,
  Translate as Languages,
  Coins,
  Globe,
  Ruler,
  Phone,
  WhiteFlag as Flag,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  Bank as Landmark,
  Reports as PieChart,
} from "iconoir-react";
import { Button } from "~/components/ui/button";

interface EligibleCountry {
  displayName: string;
  pageName?: string;
  flagUrl?: string;
  completeness: number;
  leaderTitle?: string;
  leaderName?: string;
  population?: number;
  gdp?: string;
  capital?: string;
  governmentType?: string;
  currency?: string;
  currencyCode?: string;
  languages?: string;
  areaKm2?: number;
  demonym?: string;
  lifeExpectancy?: number;
  literacyRate?: number;
  urbanization?: number;
  internetTld?: string;
  callingCode?: string;
  anthem?: string;
  motto?: string;
  coordinates?: string;
  largestCity?: string;
  officialName?: string;
}

interface CountryStatsModalProps {
  country: EligibleCountry;
  onClose: () => void;
  onImport: () => void;
}

const formatNumber = (num: number | undefined): string => {
  if (!num) return "Unknown";
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
};

const formatArea = (km2: number | undefined): string => {
  if (!km2) return "Unknown";
  const sqMi = km2 * 0.386102;
  return `${km2.toLocaleString()} km² (${sqMi.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi²)`;
};

const StatField = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
}) => {
  if (!value) return null;
  return (
    <div className="border-border/50 bg-muted/20 flex items-center gap-3 rounded-lg border p-3">
      <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
};

interface SectionCard {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: Array<{ label: string; value?: string }>;
  hasData: boolean;
}

export function CountryStatsModal({ country, onClose, onImport }: CountryStatsModalProps) {
  const [imgError, setImgError] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const showFlag = country.flagUrl && !imgError;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const sections: SectionCard[] = [
    {
      id: "identity",
      title: "National Identity",
      icon: Flag,
      hasData: !!(country.officialName || country.motto || country.anthem || country.demonym),
      fields: [
        { label: "Official Name", value: country.officialName },
        { label: "Motto", value: country.motto },
        { label: "Anthem", value: country.anthem },
        { label: "Demonym", value: country.demonym },
      ],
    },
    {
      id: "government",
      title: "Government",
      icon: Landmark,
      hasData: !!(country.governmentType || country.leaderName || country.capital),
      fields: [
        { label: "Government Type", value: country.governmentType },
        { label: country.leaderTitle || "Leader", value: country.leaderName },
        { label: "Capital", value: country.capital },
        {
          label: "Largest City",
          value: country.largestCity !== country.capital ? country.largestCity : undefined,
        },
      ],
    },
    {
      id: "economy",
      title: "Economy",
      icon: PieChart,
      hasData: !!(country.gdp || country.currency),
      fields: [
        { label: "GDP", value: country.gdp },
        { label: "Currency", value: country.currency },
        { label: "Currency Code", value: country.currencyCode },
      ],
    },
    {
      id: "demographics",
      title: "Demographics",
      icon: Users,
      hasData: !!(
        country.population ||
        country.lifeExpectancy ||
        country.literacyRate ||
        country.urbanization
      ),
      fields: [
        {
          label: "Population",
          value: country.population ? formatNumber(country.population) : undefined,
        },
        {
          label: "Life Expectancy",
          value: country.lifeExpectancy ? `${country.lifeExpectancy} years` : undefined,
        },
        {
          label: "Literacy Rate",
          value: country.literacyRate ? `${country.literacyRate}%` : undefined,
        },
        {
          label: "Urbanization",
          value: country.urbanization ? `${country.urbanization}%` : undefined,
        },
      ],
    },
    {
      id: "geography",
      title: "Geography",
      icon: Globe,
      hasData: !!(country.areaKm2 || country.coordinates),
      fields: [
        { label: "Area", value: country.areaKm2 ? formatArea(country.areaKm2) : undefined },
        { label: "Coordinates", value: country.coordinates },
      ],
    },
    {
      id: "communications",
      title: "Communications",
      icon: Phone,
      hasData: !!(country.callingCode || country.internetTld || country.languages),
      fields: [
        { label: "Languages", value: country.languages },
        {
          label: "Calling Code",
          value: country.callingCode ? `+${country.callingCode}` : undefined,
        },
        {
          label: "Internet TLD",
          value: country.internetTld ? `.${country.internetTld}` : undefined,
        },
      ],
    },
  ].filter((s) => s.hasData);

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="border-border/50 bg-card/95 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with flag */}
          <div className="relative h-36 shrink-0 overflow-hidden">
            {showFlag ? (
              <img
                src={country.flagUrl}
                alt={`Flag of ${country.displayName}`}
                className="absolute inset-0 h-full w-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 to-purple-600/30" />
            )}
            <div className="from-card via-card/80 absolute inset-0 bg-gradient-to-t to-transparent" />

            <button
              onClick={onClose}
              className="absolute top-3 right-3 rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="absolute bottom-4 left-5">
              <h2 className="text-2xl font-bold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.5)]">
                {country.displayName}
              </h2>
              {country.officialName && country.officialName !== country.displayName && (
                <p className="text-sm text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
                  {country.officialName}
                </p>
              )}
            </div>
          </div>

          {/* Quick stats row */}
          <div className="shrink-0 px-5 pt-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatField icon={MapPin} label="Capital" value={country.capital} />
              <StatField icon={Building2} label="Government" value={country.governmentType} />
              <StatField
                icon={Users}
                label="Population"
                value={country.population ? formatNumber(country.population) : undefined}
              />
              <StatField icon={TrendingUp} label="GDP" value={country.gdp} />
              <StatField
                icon={Shield}
                label={country.leaderTitle || "Leader"}
                value={country.leaderName}
              />
              <StatField icon={Coins} label="Currency" value={country.currency} />
              <StatField icon={Languages} label="Languages" value={country.languages} />
              <StatField
                icon={Ruler}
                label="Area"
                value={country.areaKm2 ? formatArea(country.areaKm2) : undefined}
              />
            </div>
          </div>

          {/* Section toggle cards */}
          <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Builder Sections
            </h3>
            {sections.map((section) => {
              const isExpanded = expandedSection === section.id;
              const Icon = section.icon;
              const populatedFields = section.fields.filter((f) => f.value);

              return (
                <div
                  key={section.id}
                  className="border-border/50 overflow-hidden rounded-lg border transition-colors"
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="hover:bg-muted/30 flex w-full items-center justify-between p-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="text-muted-foreground h-4 w-4" />
                      <span className="text-sm font-medium">{section.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {populatedFields.length} field{populatedFields.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <ChevronRight className="text-muted-foreground h-4 w-4" />
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
                        <div className="border-border/30 border-t px-3 pt-1 pb-3">
                          <div className="grid grid-cols-2 gap-2">
                            {section.fields
                              .filter((f) => f.value)
                              .map((field, i) => (
                                <div key={i} className="bg-muted/20 rounded-md p-2">
                                  <p className="text-muted-foreground text-[10px]">{field.label}</p>
                                  <p className="truncate text-xs font-medium">{field.value}</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-2 px-5 pt-2 pb-5">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
            <Button onClick={onImport} className="flex-1 bg-blue-600 text-white hover:bg-blue-700">
              Import to Builder
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
