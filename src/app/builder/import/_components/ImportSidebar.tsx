import React from "react";
import { motion } from "motion/react";
import { PreText } from "~/components/ui/pretext";
import {
  Globe,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Sparkles,
  Database,
  Users,
  DollarSign,
  MapPin,
  Building,
  Crown,
  // eslint-disable-next-line unused-imports/no-unused-imports
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";

import type { UnifiedInfoboxData } from "~/lib/unified-wiki-parser";

interface WikiSite {
  name: string;
  displayName: string;
}

interface SearchResult {
  title: string;
  flagUrl?: string | null;
}

interface ParsedCountryData extends UnifiedInfoboxData {
  population_total?: string | number;
  government?: string;
}

interface ImportSidebarProps {
  selectedSite: WikiSite;
  searchTerm: string;
  isSearching: boolean;
  selectedResult: SearchResult | null;
  parsedData: ParsedCountryData | null;
  isLoading: boolean;
}

const wikiSuggestions: Record<string, string[]> = {
  ixwiki: ["Urcea", "Burgundie", "Kiravia", "Faneria", "Alstin", "Venceia"],
  iiwiki: ["Great Gertek Horde", "Reellam", "Cetan", "Trollheim", "Valkyria"],
  althistory: ["United States", "Russian Empire", "German Reich", "British Empire", "Japan"],
};

function extractCount(parsed: ParsedCountryData): number {
  let count = 0;
  if (parsed.population || parsed.population_estimate || parsed.population_total) count++;
  if (parsed.gdpPerCapita || parsed.GDP_nominal_per_capita || parsed.GDP_PPP_per_capita) count++;
  if (parsed.capital) count++;
  if (parsed.government_type || parsed.government) count++;
  if (parsed.conventional_long_name || parsed.official_name || parsed.common_name) count++;
  return count;
}

export const ImportSidebar: React.FC<ImportSidebarProps> = ({
  selectedSite,
  searchTerm,
  isSearching,
  selectedResult,
  parsedData,
  isLoading,
}) => {
  const isActive = searchTerm.trim().length > 0 || isSearching;
  const isParsing = !!selectedResult && !parsedData && isLoading;
  const isParsed = !!parsedData;
  const suggestions = wikiSuggestions[selectedSite.name] || wikiSuggestions.ixwiki!;

  return (
    <div className="sticky top-6 w-56 space-y-4">
      {/* ─── Idle state ─── */}
      {!isActive && !isParsing && !isParsed && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <div
            className="rounded-xl border p-4 backdrop-blur-sm"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderColor: "var(--color-border-primary)",
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Database className="h-4 w-4 text-amber-400" />
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                What Gets Imported
              </span>
            </div>
            <div className="space-y-1.5">
              {[
                { icon: Users, label: "Population", color: "text-blue-400" },
                { icon: DollarSign, label: "GDP / GDP per Capita", color: "text-green-400" },
                { icon: MapPin, label: "Capital City", color: "text-red-400" },
                { icon: Building, label: "Government Type", color: "text-purple-400" },
                { icon: Globe, label: "Flag / National Symbols", color: "text-cyan-400" },
              ].map(({ icon: Icon, label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <Icon className={`h-3 w-3 ${color}`} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-xl border p-4 backdrop-blur-sm"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderColor: "var(--color-border-primary)",
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-emerald-400" />
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                After Import
              </span>
            </div>

            <div
              className="animate-fade-in space-y-3.5 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <div>
                <p className="mb-1 font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  📊 World Baseline
                </p>
                <div className="border-l border-emerald-500/30 pl-3">
                  <PreText
                    font="11px Inter, sans-serif"
                    lineHeight={16}
                    className="text-[11px] text-zinc-400"
                  >
                    Your imported Population and GDP are parsed to calculate starting GDP per Capita
                    and establish your initial Economic Tier.
                  </PreText>
                </div>
              </div>

              <div>
                <p className="mb-1 font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  ⚡ Dynamic Scaling
                </p>
                <div className="border-l border-emerald-500/30 pl-3">
                  <PreText
                    font="11px Inter, sans-serif"
                    lineHeight={16}
                    className="text-[11px] text-zinc-400"
                  >
                    Workforce size scales from population demographics, which determines baseline
                    industrial capacity, productiveness, and gross tax revenue.
                  </PreText>
                </div>
              </div>

              <div>
                <p className="mb-1 font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  ⚙️ Customizing Specifics
                </p>
                <div className="border-l border-emerald-500/30 pl-3">
                  <PreText
                    font="11px Inter, sans-serif"
                    lineHeight={16}
                    className="text-[11px] text-zinc-400"
                  >
                    Proceed through the builder steps to customize details: set corporate/income
                    taxes, configure public service funding under MyGovernment, and select national
                    policies.
                  </PreText>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Active search ─── */}
      {isActive && !isParsing && !isParsed && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <div
            className="rounded-xl border p-4 backdrop-blur-sm"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderColor: "var(--color-border-primary)",
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-400" />
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Try searching
              </span>
            </div>
            <div className="space-y-1">
              {suggestions.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <Crown className="h-3 w-3 text-amber-500" />
                  {name}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Parsing ─── */}
      {isParsing && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div
            className="rounded-xl border p-4 backdrop-blur-sm"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderColor: "var(--color-border-primary)",
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
              </motion.div>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Importing...
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {selectedResult?.flagUrl ? (
                  <img
                    src={selectedResult.flagUrl}
                    alt="Flag"
                    className="h-5 w-8 rounded-sm border object-cover"
                    style={{ borderColor: "var(--color-border-primary)" }}
                  />
                ) : (
                  <Globe
                    className="h-5 w-5 shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                )}
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {selectedResult?.title}
                </span>
              </div>
              <div className="bg-accent/30 h-1.5 w-full overflow-hidden rounded-full">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 8, ease: "easeInOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                />
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Extracting infobox data...
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
