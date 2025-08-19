import React from "react";
import { motion } from "framer-motion";
import { Import, CheckCircle, Users, DollarSign, MapPin, Building } from "lucide-react";
import { GlassCard, GlassCardContent, GlassCardHeader } from "../../components/glass/GlassCard";
import { cn } from "~/lib/utils";
import type { CountryInfoboxWithDynamicProps } from "~/lib/mediawiki-service";

interface ParsedCountryData {
  name: string;
  population?: number;
  gdpPerCapita?: number;
  gdp?: number;
  capital?: string;
  area?: number;
  government?: string;
  currency?: string;
  languages?: string;
  flag?: string;
  coatOfArms?: string;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  infobox: CountryInfoboxWithDynamicProps;
}

interface ParsedDataPreviewProps {
  parsedData: ParsedCountryData;
  handleContinueWithData: () => void;
  formatNumber: (num: number | undefined) => string;
}

export const ParsedDataPreview: React.FC<ParsedDataPreviewProps> = ({
  parsedData,
  handleContinueWithData,
  formatNumber,
}) => {
  return (
    <GlassCard
      depth="modal"
      blur="heavy"
      gradient="dynamic"
      theme="neutral"
      motionPreset="scale"
      className="relative overflow-hidden"
    >
      {/* Flag Background */}
      {parsedData.flagUrl && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={parsedData.flagUrl}
            alt={`Flag of ${parsedData.name}`}
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
      <GlassCardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-success)/20',
                borderColor: 'var(--color-success)/30'
              }}
            >
              <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Successfully Parsed: {parsedData.name}
              </h2>
              <p className="text-sm text-text-muted">
                Ready for import and customization
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleContinueWithData}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-lg font-medium",
              "transition-all duration-200 border"
            )}
            style={{
              backgroundColor: 'var(--color-brand-primary)',
              borderColor: 'var(--color-brand-primary)',
              color: 'white'
            }}
          >
            <Import className="h-4 w-4" />
            Continue with Data
          </motion.button>
        </div>
      </GlassCardHeader>
      <GlassCardContent className="relative z-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            className="p-4 rounded-lg border transition-all duration-200 hover:shadow-md backdrop-blur-sm"
            style={{
              backgroundColor: 'var(--color-bg-surface)/80',
              borderColor: 'var(--color-border-primary)'
            }}
            title="Total population of the country"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4" style={{ color: 'var(--color-info)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Population</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {formatNumber(parsedData.population)}
            </p>
          </div>

          <div
            className="p-4 rounded-lg border transition-all duration-200 hover:shadow-md backdrop-blur-sm"
            style={{
              backgroundColor: 'var(--color-bg-surface)/80',
              borderColor: 'var(--color-border-primary)'
            }}
            title="Gross Domestic Product per capita"
          >
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>GDP per Capita</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              ${formatNumber(parsedData.gdpPerCapita)}
            </p>
          </div>

          <div
            className="p-4 rounded-lg border transition-all duration-200 hover:shadow-md backdrop-blur-sm"
            style={{
              backgroundColor: 'var(--color-bg-surface)/80',
              borderColor: 'var(--color-border-primary)'
            }}
            title="Capital city of the country"
          >
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Capital</span>
            </div>
            <div
              className="text-lg font-semibold [&_a]:text-brand-primary [&_a]:hover:underline"
              style={{ color: 'var(--color-text-primary)' }}
              dangerouslySetInnerHTML={{ __html: parsedData.capital || 'Unknown' }}
            />
          </div>

          <div
            className="p-4 rounded-lg border transition-all duration-200 hover:shadow-md backdrop-blur-sm"
            style={{
              backgroundColor: 'var(--color-bg-surface)/80',
              borderColor: 'var(--color-border-primary)'
            }}
            title="Type of government system"
          >
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-4 w-4" style={{ color: 'var(--color-brand-secondary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Government</span>
            </div>
            <div
              className="text-lg font-semibold [&_a]:text-brand-primary [&_a]:hover:underline"
              style={{ color: 'var(--color-text-primary)' }}
              dangerouslySetInnerHTML={{ __html: parsedData.government || 'Unknown' }}
            />
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 pt-6 border-t border-border-primary">
          <h3 className="text-md font-medium text-text-primary mb-3">Additional Information</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            {parsedData.currency && (
              <div>
                <span className="font-medium text-text-primary">Currency:</span>
                <span
                  className="ml-2 text-text-muted [&_a]:text-text-secondary [&_a]:hover:underline"
                  dangerouslySetInnerHTML={{ __html: parsedData.currency }}
                />
              </div>
            )}
            {parsedData.languages && (
              <div>
                <span className="font-medium text-text-primary">Languages:</span>
                <span
                  className="ml-2 text-text-muted [&_a]:text-text-secondary [&_a]:hover:underline"
                  dangerouslySetInnerHTML={{ __html: parsedData.languages }}
                />
              </div>
            )}
            {parsedData.area && (
              <div>
                <span className="font-medium text-text-primary">Area:</span>
                <span className="ml-2 text-text-muted">{formatNumber(parsedData.area)} km²</span>
              </div>
            )}
          </div>

          {/* Symbols Section - Flag and Coat of Arms */}
          {((parsedData.flag || parsedData.flagUrl) || (parsedData.coatOfArms || parsedData.coatOfArmsUrl)) && (
            <div className="mt-6 pt-6 border-t border-border-primary">
              <h3 className="text-md font-medium text-text-primary mb-4">National Symbols</h3>
              <div className="flex flex-wrap gap-6">
                {(parsedData.flag || parsedData.flagUrl) && (
                  <div className="flex flex-col items-center">
                    <div
                      className="p-3 rounded-lg border shadow-sm backdrop-blur-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-surface)/80',
                        borderColor: 'var(--color-border-primary)'
                      }}
                    >
                      {parsedData.flagUrl ? (
                        <img
                          src={parsedData.flagUrl}
                          alt={`Flag of ${parsedData.name}`}
                          className="w-24 h-16 object-cover rounded border border-border-primary shadow-sm"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const container = target.parentElement;
                            if (container) {
                              container.innerHTML = `<div class="w-24 h-16 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)] flex items-center justify-center"><span class="text-xs text-[var(--color-text-muted)] text-center px-2">${parsedData.flag}</span></div>`;
                            }
                          }}
                        />
                      ) : (
                        <div className="w-24 h-16 bg-gradient-to-br from-bg-secondary to-bg-tertiary rounded border border-border-primary flex items-center justify-center">
                          <span className="text-xs text-text-muted text-center px-2">{parsedData.flag}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-text-primary mt-2">Flag</span>
                  </div>
                )}

                {(parsedData.coatOfArms || parsedData.coatOfArmsUrl) && (
                  <div className="flex flex-col items-center">
                    <div
                      className="p-3 rounded-lg border shadow-sm backdrop-blur-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-surface)/80',
                        borderColor: 'var(--color-border-primary)'
                      }}
                    >
                      {parsedData.coatOfArmsUrl ? (
                        <img
                          src={parsedData.coatOfArmsUrl}
                          alt={`Coat of Arms of ${parsedData.name}`}
                          className="w-16 h-16 object-contain rounded border border-border-primary shadow-sm"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const container = target.parentElement;
                            if (container) {
                              container.innerHTML = `<div class="w-16 h-16 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)] flex items-center justify-center"><span class="text-xs text-[var(--color-text-muted)] text-center px-1">${parsedData.coatOfArms}</span></div>`;
                            }
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-bg-secondary to-bg-tertiary rounded border border-border-primary flex items-center justify-center">
                          <span className="text-xs text-text-muted text-center px-1">{parsedData.coatOfArms}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-text-primary mt-2">Coat of Arms</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
};
