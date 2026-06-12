import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Users,
  DollarSign,
  MapPin,
  Building,
  ExternalLink,
  Crown,
  Globe,
} from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
} from "~/app/builder/components/glass/GlassCard";
import { sanitizeWikiContent } from "~/lib/sanitize-html";

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  namespace?: number;
  flagUrl?: string | null;
  population?: number;
  gdpPerCapita?: number;
  capital?: string;
  government?: string;
  currency?: string;
  languages?: string;
  area?: number;
  gdp?: number;
  leader?: string;
  leaderTitle?: string;
  establishedDate?: string;
  timezone?: string;
  drivingSide?: string;
  callingCode?: string;
  internetTld?: string;
  motto?: string;
  demonym?: string;
  continent?: string;
}

interface CountryPreviewProps {
  selectedResult: SearchResult;
  onCancel: () => void;
  onContinue: () => void;
  formatNumber: (num: number | undefined, decimals?: number) => string;
  isVisible: boolean;
}

export const CountryPreview: React.FC<CountryPreviewProps> = ({
  selectedResult,
  onCancel,
  onContinue,
  formatNumber,
  isVisible,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{
            duration: 0.4,
            ease: [0.34, 1.56, 0.64, 1],
          }}
          className="absolute inset-0 z-10 p-4"
        >
          <GlassCard
            depth="modal"
            blur="heavy"
            theme="neutral"
            className="glass-hierarchy-parent glass-refraction relative overflow-hidden"
          >
            {/* Enhanced glass background with flag blur */}
            {selectedResult.flagUrl && (
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={selectedResult.flagUrl}
                  alt={`Flag of ${selectedResult.title}`}
                  className="absolute inset-0 h-full w-full scale-[1.2] object-cover opacity-10 blur-3xl brightness-[0.5] saturate-[0.7]"
                />
                <div className="from-background/90 via-card/95 to-background/90 absolute inset-0 bg-gradient-to-br backdrop-blur" />
              </div>
            )}

            <GlassCardHeader className="relative z-10 pb-4">
              <div className="mb-3 flex items-center justify-between">
                <motion.button
                  whileHover={{ scale: 1.05, x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onCancel}
                  className="border-border bg-card/80 text-foreground flex items-center gap-2 rounded-md border px-3 py-1.5 backdrop-blur-sm transition-all duration-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Back</span>
                </motion.button>

                <div className="flex items-center gap-3">
                  {selectedResult.flagUrl ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                      className="border-border bg-card/80 rounded border p-0.5 backdrop-blur-sm"
                    >
                      <img
                        src={selectedResult.flagUrl}
                        alt={`Flag of ${selectedResult.title}`}
                        className="border-border-primary h-6 w-10 rounded border object-cover shadow-sm"
                      />
                    </motion.div>
                  ) : (
                    <div className="border-border bg-card/80 flex h-6 w-10 items-center justify-center rounded border backdrop-blur-sm">
                      <Globe className="text-muted-foreground h-4 w-4" />
                    </div>
                  )}
                  <div>
                    <motion.h1
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-foreground flex items-center gap-2 text-xl font-bold"
                    >
                      {selectedResult.title}
                      <Crown className="text-brand-primary h-4 w-4" />
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-muted-foreground text-xs"
                    >
                      Country Preview
                    </motion.p>
                  </div>
                </div>
              </div>
            </GlassCardHeader>

            <GlassCardContent className="relative z-10 space-y-4">
              {/* Country Statistics */}
              {(selectedResult.population ||
                selectedResult.gdpPerCapita ||
                selectedResult.capital ||
                selectedResult.government) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="border-border bg-card/80 rounded-lg border p-4 backdrop-blur-sm"
                >
                  <h3 className="text-foreground mb-3 flex items-center gap-2 text-base font-semibold">
                    <Building className="text-info h-4 w-4" />
                    Key Information
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {selectedResult.population && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="border-border bg-card/80 rounded border p-3 backdrop-blur-sm transition-all duration-200 hover:shadow-sm"
                        title="Total population of the country"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Users className="text-info h-3.5 w-3.5" />
                          <span className="text-muted-foreground text-xs font-medium">
                            Population
                          </span>
                        </div>
                        <p className="text-foreground text-sm font-semibold">
                          {formatNumber(selectedResult.population, 0)}
                        </p>
                      </motion.div>
                    )}

                    {selectedResult.gdpPerCapita && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.45 }}
                        className="border-border bg-card/80 rounded border p-3 backdrop-blur-sm transition-all duration-200 hover:shadow-sm"
                        title="Gross Domestic Product per capita"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <DollarSign className="text-success h-3.5 w-3.5" />
                          <span className="text-muted-foreground text-xs font-medium">
                            GDP per Capita
                          </span>
                        </div>
                        <p className="text-foreground text-sm font-semibold">
                          ${formatNumber(selectedResult.gdpPerCapita)}
                        </p>
                      </motion.div>
                    )}

                    {selectedResult.capital && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="border-border bg-card/80 rounded border p-3 backdrop-blur-sm transition-all duration-200 hover:shadow-sm"
                        title="Capital city of the country"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <MapPin className="text-error h-3.5 w-3.5" />
                          <span className="text-muted-foreground text-xs font-medium">Capital</span>
                        </div>
                        <div
                          className="text-foreground [&_a]:text-brand-primary text-sm font-semibold [&_a]:hover:underline"
                          // SECURITY: Sanitize wiki content
                          dangerouslySetInnerHTML={{
                            __html: sanitizeWikiContent(selectedResult.capital || "Unknown"),
                          }}
                        />
                      </motion.div>
                    )}

                    {selectedResult.government && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.55 }}
                        className="border-border bg-card/80 rounded border p-3 backdrop-blur-sm transition-all duration-200 hover:shadow-sm"
                        title="Type of government system"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Building className="text-brand-secondary h-3.5 w-3.5" />
                          <span className="text-muted-foreground text-xs font-medium">
                            Government
                          </span>
                        </div>
                        <div
                          className="text-foreground [&_a]:text-brand-primary text-sm font-semibold [&_a]:hover:underline"
                          // SECURITY: Sanitize wiki content
                          dangerouslySetInnerHTML={{
                            __html: sanitizeWikiContent(selectedResult.government || "Unknown"),
                          }}
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Description */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="border-border bg-card/80 rounded-lg border p-4 backdrop-blur-sm"
              >
                <h3 className="text-foreground mb-2 flex items-center gap-2 text-base font-semibold">
                  <ExternalLink className="text-brand-primary h-4 w-4" />
                  Description
                </h3>
                <p
                  className="text-text-secondary [&_a]:text-brand-primary line-clamp-3 text-sm leading-relaxed [&_a]:hover:underline"
                  // SECURITY: Sanitize wiki snippet
                  dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(selectedResult.snippet) }}
                />
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex gap-3 pt-2"
              >
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCancel}
                  className="border-border bg-card/80 text-foreground flex-1 rounded border px-4 py-2 backdrop-blur-sm transition-all duration-200"
                >
                  <span className="text-sm font-medium">Cancel</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onContinue}
                  className="bg-brand-primary border-brand-primary flex-1 rounded border px-4 py-2 text-white backdrop-blur-sm transition-all duration-200"
                >
                  <span className="text-sm font-medium">Import Country</span>
                </motion.button>
              </motion.div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
