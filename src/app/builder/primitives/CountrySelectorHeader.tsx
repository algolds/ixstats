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
        {/* Back Button and Process Indicator */}
        <div className="flex items-center justify-center mb-6 relative">
          {onBackToIntro && (
            <Button
              onClick={onBackToIntro}
              variant="outline"
              size="sm"
              className="absolute left-0 flex items-center gap-2 bg-[var(--color-bg-secondary)]/80 border-[var(--color-border-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80"
            >
              <ArrowLeft className="h-4 w-4" />
            Start over
            </Button>
          )}
          
          {/* Process Indicator - Centered */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--mycountry-primary)]/20 border border-[var(--mycountry-primary)]/30 rounded-full">
              <Check className="h-4 w-4 text-[var(--mycountry-primary)]" />
              <span className="text-sm font-medium text-[var(--mycountry-primary)]">Step 1 Complete</span>
            </div>
            <div className="w-8 h-px bg-[var(--color-border-primary)]"></div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--mycountry-secondary)]/20 border border-[var(--mycountry-secondary)]/50 rounded-full">
              <div className="h-4 w-4 rounded-full bg-[var(--mycountry-secondary)] animate-pulse"></div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Step 2: Foundation</span>
            </div>
          </div>
        </div>
        {/* Main Content */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            {softSelectedCountry ? (
              <EnhancedCountryFlag
                countryName={softSelectedCountry.name}
                size="lg"
                hoverBlur={false}
                priority={true}
              />
            ) : (
              <MyCountryLogo size="xxl" animated />
            )}
          </div>
          
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
                 Select up to 5 Archetypes or {' '}
                <Highlighter action="underline" color="#87CEFA">
                start from scratch with the Composer
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