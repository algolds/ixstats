"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, ArrowLeft, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createUrl } from '~/lib/url-utils';
import { EnhancedCountryFlag } from '~/components/ui/enhanced-country-flag';
import { MyCountryLogo } from '~/components/ui/mycountry-logo';
import { SectionHeader, EmphasisText } from '~/components/ui/text-hierarchy';
import { ImportButton } from '~/components/ui/glass-button';
import { Button } from '~/components/ui/button';
import type { RealCountryData } from '../lib/economy-data-service';
import { Highlighter } from "@/components/magicui/highlighter";
import { Globe } from '~/components/magicui/globe';

interface CountrySelectorHeaderProps {
  softSelectedCountry: RealCountryData | null;
  onBackToIntro?: () => void;
}

export function CountrySelectorHeader({ softSelectedCountry, onBackToIntro }: CountrySelectorHeaderProps) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 relative overflow-hidden rounded-lg p-6"
      style={
        softSelectedCountry
          ? {
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {softSelectedCountry && (
        <div className="absolute inset-0 backdrop-filter backdrop-blur-md bg-black/50 z-0"></div>
      )}
      <div className="relative z-10">
        {/* Back Button and Process Indicator */}
        <div className="flex items-center justify-between mb-6">
          {onBackToIntro && (
            <Button
              onClick={onBackToIntro}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-[var(--color-bg-secondary)]/80 border-[var(--color-border-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/80"
            >
              <ArrowLeft className="h-4 w-4" />
            Start over
            </Button>
          )}
          
          {/* Process Indicator */}
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
                <h2 className="text-4xl font-bold text-[var(--color-text-primary)]">
                  Foundation: {softSelectedCountry.name}
                </h2>
                <p className="text-[var(--color-text-secondary)] text-lg">
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