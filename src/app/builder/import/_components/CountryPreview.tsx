import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { cn } from "~/lib/utils";
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
  formatNumber: (num: number | undefined) => string;
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
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-10 blur-3xl"
                  style={{
                    filter: "blur(24px) saturate(0.7) brightness(0.5)",
                    transform: "scale(1.2)",
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-bg-primary)/90 0%, var(--color-bg-secondary)/95 50%, var(--color-bg-primary)/90 100%)",
                    backdropFilter: "blur(8px)",
                  }}
                />
              </div>
            )}

            <GlassCardHeader className="relative z-10 pb-4">
              <div className="mb-3 flex items-center justify-between">
                <motion.button
                  whileHover={{ scale: 1.05, x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onCancel}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 backdrop-blur-sm transition-all duration-200"
                  style={{
                    backgroundColor: "var(--color-bg-surface)/80",
                    borderColor: "var(--color-border-primary)",
                    color: "var(--color-text-primary)",
                  }}
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
                      className="rounded border p-0.5 backdrop-blur-sm"
                      style={{
                        backgroundColor: "var(--color-bg-surface)/80",
                        borderColor: "var(--color-border-primary)",
                      }}
                    >
                      <img
                        src={selectedResult.flagUrl}
                        alt={`Flag of ${selectedResult.title}`}
                        className="border-border-primary h-6 w-10 rounded border object-cover shadow-sm"
                      />
                    </motion.div>
                  ) : (
                    <div
                      className="flex h-6 w-10 items-center justify-center rounded border backdrop-blur-sm"
                      style={{
                        backgroundColor: "var(--color-bg-surface)/80",
                        borderColor: "var(--color-border-primary)",
                      }}
                    >
                      <Globe className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                    </div>
                  )}
                  <div>
                    <motion.h1
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center gap-2 text-xl font-bold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {selectedResult.title}
                      <Crown className="h-4 w-4" style={{ color: "var(--color-brand-primary)" }} />
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
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
                  className="rounded-lg border p-4 backdrop-blur-sm"
                  style={{
                    backgroundColor: "var(--color-bg-surface)/80",
                    borderColor: "var(--color-border-primary)",
                  }}
                >
                  <h3
                    className="mb-3 flex items-center gap-2 text-base font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    <Building className="h-4 w-4" style={{ color: "var(--color-info)" }} />
                    Key Information
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {selectedResult.population && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="rounded border p-3 backdrop-blur-sm transition-all duration-200 hover:shadow-sm"
                        style={{
                          backgroundColor: "var(--color-bg-surface)/80",
                          borderColor: "var(--color-border-primary)",
                        }}
                        title="Total population of the country"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" style={{ color: "var(--color-info)" }} />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Population
                          </span>
                        </div>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {formatNumber(selectedResult.population)}
                        </p>
                      </motion.div>
                    )}

                    {selectedResult.gdpPerCapita && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.45 }}
                        className="rounded border p-3 backdrop-blur-sm transition-all duration-200 hover:shadow-sm"
                        style={{
                          backgroundColor: "var(--color-bg-surface)/80",
                          borderColor: "var(--color-border-primary)",
                        }}
                        title="Gross Domestic Product per capita"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <DollarSign
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--color-success)" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            GDP per Capita
                          </span>
                        </div>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          ${formatNumber(selectedResult.gdpPerCapita)}
                        </p>
                      </motion.div>
                    )}

                    {selectedResult.capital && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="rounded border p-3 backdrop-blur-sm transition-all duration-200 hover:shadow-sm"
                        style={{
                          backgroundColor: "var(--color-bg-surface)/80",
                          borderColor: "var(--color-border-primary)",
                        }}
                        title="Capital city of the country"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" style={{ color: "var(--color-error)" }} />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Capital
                          </span>
                        </div>
                        <div
                          className="[&_a]:text-brand-primary text-sm font-semibold [&_a]:hover:underline"
                          style={{ color: "var(--color-text-primary)" }}
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
                        className="rounded border p-3 backdrop-blur-sm transition-all duration-200 hover:shadow-sm"
                        style={{
                          backgroundColor: "var(--color-bg-surface)/80",
                          borderColor: "var(--color-border-primary)",
                        }}
                        title="Type of government system"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Building
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--color-brand-secondary)" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Government
                          </span>
                        </div>
                        <div
                          className="[&_a]:text-brand-primary text-sm font-semibold [&_a]:hover:underline"
                          style={{ color: "var(--color-text-primary)" }}
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
                className="rounded-lg border p-4 backdrop-blur-sm"
                style={{
                  backgroundColor: "var(--color-bg-surface)/80",
                  borderColor: "var(--color-border-primary)",
                }}
              >
                <h3
                  className="mb-2 flex items-center gap-2 text-base font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <ExternalLink
                    className="h-4 w-4"
                    style={{ color: "var(--color-brand-primary)" }}
                  />
                  Description
                </h3>
                <p
                  className="[&_a]:text-brand-primary line-clamp-3 text-sm leading-relaxed [&_a]:hover:underline"
                  style={{ color: "var(--color-text-secondary)" }}
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
                  className="flex-1 rounded border px-4 py-2 backdrop-blur-sm transition-all duration-200"
                  style={{
                    backgroundColor: "var(--color-bg-surface)/80",
                    borderColor: "var(--color-border-primary)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  <span className="text-sm font-medium">Cancel</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onContinue}
                  className="flex-1 rounded border px-4 py-2 backdrop-blur-sm transition-all duration-200"
                  style={{
                    backgroundColor: "var(--color-brand-primary)",
                    borderColor: "var(--color-brand-primary)",
                    color: "white",
                  }}
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
