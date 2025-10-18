import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, DollarSign, MapPin, Building, ExternalLink, Crown, Globe } from "lucide-react";
import { GlassCard, GlassCardContent, GlassCardHeader } from "~/app/builder/components/glass/GlassCard";
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
                  className="absolute inset-0 w-full h-full object-cover opacity-10 blur-3xl scale-110"
                  style={{
                    filter: 'blur(24px) saturate(0.7) brightness(0.5)',
                    transform: 'scale(1.2)'
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-bg-primary)/90 0%, var(--color-bg-secondary)/95 50%, var(--color-bg-primary)/90 100%)',
                    backdropFilter: 'blur(8px)'
                  }}
                />
              </div>
            )}

            <GlassCardHeader className="relative z-10 pb-4">
              <div className="flex items-center justify-between mb-3">
                <motion.button
                  whileHover={{ scale: 1.05, x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onCancel}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all duration-200 backdrop-blur-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-surface)/80',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
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
                      className="p-0.5 rounded border backdrop-blur-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-surface)/80',
                        borderColor: 'var(--color-border-primary)'
                      }}
                    >
                      <img
                        src={selectedResult.flagUrl}
                        alt={`Flag of ${selectedResult.title}`}
                        className="w-10 h-6 object-cover rounded border border-border-primary shadow-sm"
                      />
                    </motion.div>
                  ) : (
                    <div 
                      className="w-10 h-6 rounded border flex items-center justify-center backdrop-blur-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-surface)/80',
                        borderColor: 'var(--color-border-primary)'
                      }}
                    >
                      <Globe className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  )}
                  <div>
                    <motion.h1
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-xl font-bold flex items-center gap-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selectedResult.title}
                      <Crown className="h-4 w-4" style={{ color: 'var(--color-brand-primary)' }} />
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Country Preview
                    </motion.p>
                  </div>
                </div>
              </div>
            </GlassCardHeader>

            <GlassCardContent className="relative z-10 space-y-4">
              {/* Country Statistics */}
              {(selectedResult.population || selectedResult.gdpPerCapita || selectedResult.capital || selectedResult.government) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-lg p-4 border backdrop-blur-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-surface)/80',
                    borderColor: 'var(--color-border-primary)'
                  }}
                >
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                    <Building className="h-4 w-4" style={{ color: 'var(--color-info)' }} />
                    Key Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedResult.population && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="p-3 rounded border transition-all duration-200 hover:shadow-sm backdrop-blur-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-surface)/80',
                          borderColor: 'var(--color-border-primary)'
                        }}
                        title="Total population of the country"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-3.5 w-3.5" style={{ color: 'var(--color-info)' }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Population</span>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          {formatNumber(selectedResult.population)}
                        </p>
                      </motion.div>
                    )}

                    {selectedResult.gdpPerCapita && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.45 }}
                        className="p-3 rounded border transition-all duration-200 hover:shadow-sm backdrop-blur-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-surface)/80',
                          borderColor: 'var(--color-border-primary)'
                        }}
                        title="Gross Domestic Product per capita"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-3.5 w-3.5" style={{ color: 'var(--color-success)' }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>GDP per Capita</span>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          ${formatNumber(selectedResult.gdpPerCapita)}
                        </p>
                      </motion.div>
                    )}

                    {selectedResult.capital && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="p-3 rounded border transition-all duration-200 hover:shadow-sm backdrop-blur-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-surface)/80',
                          borderColor: 'var(--color-border-primary)'
                        }}
                        title="Capital city of the country"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--color-error)' }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Capital</span>
                        </div>
                        <div
                          className="text-sm font-semibold [&_a]:text-brand-primary [&_a]:hover:underline"
                          style={{ color: 'var(--color-text-primary)' }}
                          // SECURITY: Sanitize wiki content
                          dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(selectedResult.capital || 'Unknown') }}
                        />
                      </motion.div>
                    )}

                    {selectedResult.government && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.55 }}
                        className="p-3 rounded border transition-all duration-200 hover:shadow-sm backdrop-blur-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-surface)/80',
                          borderColor: 'var(--color-border-primary)'
                        }}
                        title="Type of government system"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Building className="h-3.5 w-3.5" style={{ color: 'var(--color-brand-secondary)' }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Government</span>
                        </div>
                        <div
                          className="text-sm font-semibold [&_a]:text-brand-primary [&_a]:hover:underline"
                          style={{ color: 'var(--color-text-primary)' }}
                          // SECURITY: Sanitize wiki content
                          dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(selectedResult.government || 'Unknown') }}
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
                className="rounded-lg p-4 border backdrop-blur-sm"
                style={{
                  backgroundColor: 'var(--color-bg-surface)/80',
                  borderColor: 'var(--color-border-primary)'
                }}
              >
                <h3 className="text-base font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                  <ExternalLink className="h-4 w-4" style={{ color: 'var(--color-brand-primary)' }} />
                  Description
                </h3>
                <p
                  className="text-sm leading-relaxed [&_a]:text-brand-primary [&_a]:hover:underline line-clamp-3"
                  style={{ color: 'var(--color-text-secondary)' }}
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
                  className="flex-1 px-4 py-2 rounded border transition-all duration-200 backdrop-blur-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-surface)/80',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <span className="text-sm font-medium">Cancel</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onContinue}
                  className="flex-1 px-4 py-2 rounded border transition-all duration-200 backdrop-blur-sm"
                  style={{
                    backgroundColor: 'var(--color-brand-primary)',
                    borderColor: 'var(--color-brand-primary)',
                    color: 'white'
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