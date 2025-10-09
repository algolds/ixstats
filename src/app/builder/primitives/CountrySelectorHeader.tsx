"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, ArrowLeft, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createUrl } from '~/lib/url-utils';
import { EnhancedCountryFlag } from '~/components/ui/enhanced-country-flag';
import { useCountryFlag } from '~/hooks/useCountryFlags';
import { MyCountryLogo } from '~/components/ui/mycountry-logo';
import { SectionHeader, EmphasisText } from '~/components/ui/text-hierarchy';
import { ImportButton } from '~/components/ui/glass-button';
import { Button } from '~/components/ui/button';
import type { RealCountryData } from '../lib/economy-data-service';
import { Highlighter } from "@/components/magicui/highlighter";
import { Globe } from '~/components/magicui/globe';
import { getOptimalTextStyling } from '~/lib/flag-color-analysis';

interface CountrySelectorHeaderProps {
  softSelectedCountry: RealCountryData | null;
  onBackToIntro?: () => void;
}

export function CountrySelectorHeader({ softSelectedCountry, onBackToIntro }: CountrySelectorHeaderProps) {
  const router = useRouter();
  const { flag } = useCountryFlag(softSelectedCountry?.foundationCountryName || softSelectedCountry?.name || '');
  const [textStyling, setTextStyling] = useState<{
    color: string;
    textShadow?: string;
  }>({
    color: 'white',
    textShadow: [
      '0 0 20px rgba(0, 0, 0, 0.9)',
      '0 0 10px rgba(0, 0, 0, 0.8)',
      '0 2px 4px rgba(0, 0, 0, 0.9)',
      '0 1px 2px rgba(0, 0, 0, 1)',
      '1px 1px 0 rgba(0, 0, 0, 0.8)',
      '-1px -1px 0 rgba(0, 0, 0, 0.8)',
      '1px -1px 0 rgba(0, 0, 0, 0.8)',
      '-1px 1px 0 rgba(0, 0, 0, 0.8)'
    ].join(', ')
  });

  // Analyze flag colors when country or flag changes
  useEffect(() => {
    const analyzeFlag = async () => {
      if (softSelectedCountry && flag?.flagUrl) {
        try {
          const styling = await getOptimalTextStyling(
            flag.flagUrl, 
            softSelectedCountry.foundationCountryName || softSelectedCountry.name
          );
          setTextStyling(styling);
        } catch (error) {
          console.warn('Failed to analyze flag colors for', softSelectedCountry.name, error);
          // Keep default styling on error
        }
      } else {
        // Reset to default when no country/flag
        setTextStyling({
          color: 'var(--color-text-primary)',
          textShadow: undefined
        });
      }
    };

    analyzeFlag();
  }, [softSelectedCountry, flag?.flagUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 relative overflow-hidden rounded-lg p-6"
      style={
        softSelectedCountry && flag?.flagUrl
          ? {
              backgroundImage: `url('${flag.flagUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {softSelectedCountry && flag?.flagUrl && (
        <div className="absolute inset-0 backdrop-filter backdrop-blur-lg bg-black/40 z-0"></div>
      )}
      {softSelectedCountry && !flag?.flagUrl && (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--mycountry-primary)]/20 to-[var(--mycountry-secondary)]/20 z-0"></div>
      )}
      <div className="relative z-10">
        {/* Main Content */}
        <div className="text-center">
          {softSelectedCountry && (
            <div className="flex items-center justify-center gap-4 mb-6">
              <EnhancedCountryFlag
                countryName={softSelectedCountry.name}
                size="lg"
                hoverBlur={false}
                priority={true}
              />
            </div>
          )}
          
          <div className="space-y-3">
            {softSelectedCountry ? (
              <>
                <h2 
                  className="text-4xl font-bold tracking-tight"
                  style={{
                    color: textStyling.color,
                    textShadow: textStyling.textShadow,
                    filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.5))'
                  }}
                >
                  Foundation: {softSelectedCountry.name}
                </h2>
                <p 
                  className="text-lg font-medium"
                  style={{
                    color: textStyling.color,
                    textShadow: textStyling.textShadow,
                    filter: 'drop-shadow(0 0 6px rgba(0, 0, 0, 0.4))'
                  }}
                >
                  Selected as your economic foundation template
                </p>
              </>
            ) : (
              <>

                <p className="text-[var(--color-text-secondary)] text-lg">
                 Select up to 5 Archetype presets or {' '}
                <Highlighter action="underline" color="#FFC107">
                build your country from scratch
                </Highlighter>  {' '} to get started
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}