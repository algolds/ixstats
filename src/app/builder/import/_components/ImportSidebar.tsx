import React from "react";
import { motion } from "motion/react";
import { Globe, Sparkles, Database, Users, DollarSign, MapPin, Building, Crown, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

interface WikiSite {
  name: string;
  displayName: string;
}

interface SearchResult {
  title: string;
  flagUrl?: string | null;
}

interface ParsedCountryData {
  wikiIntro?: string;
  flagUrl?: string | null;
  conventional_long_name?: string;
  official_name?: string;
  common_name?: string;
  population?: string | number;
  population_estimate?: string | number;
  population_total?: string | number;
  gdpPerCapita?: string | number;
  GDP_nominal_per_capita?: string | number;
  GDP_PPP_per_capita?: string | number;
  capital?: string;
  government_type?: string;
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
    <div className="sticky top-6 space-y-4">
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
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
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
                <div key={label} className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
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
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                After Import
              </span>
            </div>

            <div className="space-y-3.5 text-xs animate-fade-in" style={{ color: "var(--color-text-muted)" }}>
              <div>
                <p className="font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>📊 World Baseline</p>
                <p className="leading-relaxed pl-3 border-l border-emerald-500/30">
                  Your imported Population and GDP are parsed to calculate starting GDP per Capita and establish your initial <span className="text-emerald-400 font-medium">Economic Tier</span>.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>⚡ Dynamic Scaling</p>
                <p className="leading-relaxed pl-3 border-l border-emerald-500/30">
                  Workforce size scales from population demographics, which determines baseline industrial capacity, productiveness, and gross tax revenue.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>⚙️ Customizing Specifics</p>
                <p className="leading-relaxed pl-3 border-l border-emerald-500/30">
                  Proceed through the builder steps to customize details: set corporate/income taxes, configure public service funding under <span className="text-blue-400 font-medium">MyGovernment</span>, and select national policies.
                </p>
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
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
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
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
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
                  <Globe className="h-5 w-5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
                )}
                <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {selectedResult?.title}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/30">
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

      {/* ─── Parsed ─── */}
      {isParsed && parsedData && (
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
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Data Extracted
              </span>
            </div>
            <div className="mb-3 flex items-center gap-3">
              {parsedData.flagUrl ? (
                <img
                  src={parsedData.flagUrl}
                  alt="Flag"
                  className="h-6 w-10 rounded-sm border object-cover"
                  style={{ borderColor: "var(--color-border-primary)" }}
                />
              ) : selectedResult?.flagUrl ? (
                <img
                  src={selectedResult.flagUrl}
                  alt="Flag"
                  className="h-6 w-10 rounded-sm border object-cover"
                  style={{ borderColor: "var(--color-border-primary)" }}
                />
              ) : (
                <Globe className="h-6 w-6 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
              )}
              <div>
                <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {parsedData.common_name || parsedData.official_name || parsedData.conventional_long_name || selectedResult?.title}
                </span>
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  From: {selectedSite.displayName}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {parsedData.population && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <Users className="h-3 w-3 text-blue-400" />
                  Population: {String(parsedData.population)}
                </div>
              )}
              {(parsedData.gdpPerCapita || parsedData.GDP_nominal_per_capita || parsedData.GDP_PPP_per_capita) && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <DollarSign className="h-3 w-3 text-green-400" />
                  GDP/Capita: {String(parsedData.gdpPerCapita || parsedData.GDP_nominal_per_capita || parsedData.GDP_PPP_per_capita)}
                </div>
              )}
              {parsedData.capital && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <MapPin className="h-3 w-3 text-red-400" />
                  Capital: {parsedData.capital}
                </div>
              )}
              {(parsedData.government_type || parsedData.government) && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <Building className="h-3 w-3 text-purple-400" />
                  Govt: {parsedData.government_type || parsedData.government}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <Database className="h-3 w-3 text-amber-400" />
                {extractCount(parsedData)}/8 fields extracted
              </div>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-accent/30">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${(extractCount(parsedData) / 8) * 100}%` }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
