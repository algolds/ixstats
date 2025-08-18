"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createUrl } from '~/lib/url-utils';
import { EnhancedCountryFlag } from '~/components/ui/enhanced-country-flag';
import { MyCountryLogo } from '~/components/ui/mycountry-logo';
import { SectionHeader, EmphasisText } from '~/components/ui/text-hierarchy';
import { ImportButton } from '~/components/ui/glass-button';
import type { RealCountryData } from '../lib/economy-data-service';
import { Highlighter } from "@/components/magicui/highlighter";

interface CountrySelectorHeaderProps {
  softSelectedCountry: RealCountryData | null;
}

export function CountrySelectorHeader({ softSelectedCountry }: CountrySelectorHeaderProps) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8 relative overflow-hidden rounded-lg p-6"
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
        <div className="flex items-center justify-center gap-4 mb-6">
          {softSelectedCountry ? (
            <EnhancedCountryFlag
              countryName={softSelectedCountry.name}
              size="lg"
              hoverBlur={false}
              priority={true}
            />
          ) : (
            <MyCountryLogo size="xl" animated />
          )}
        </div>
        
        <div className="space-y-3 mb-6">
          {softSelectedCountry ? (
            <h2 className="text-4xl font-bold text-[var(--color-text-primary)]">
              Foundation: {softSelectedCountry.name}
            </h2>
          ) : (
            <h4 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Create a Country
              </h4>
          )}
          <p className="text-[var(--color-text-secondary)] text-lg">
            Select a foundation country or{' '}
            <Highlighter action="underline" color="#87CEFA">
              import your existing country to get started.  </Highlighter>
          </p>
        </div>

        {/* Import Button */}
        <ImportButton
          onClick={() => router.push(createUrl('/builder/import'))}
          size="lg"
          depth="deep"
          className="inline-flex items-center gap-3"
        >
          <Download className="h-5 w-5" />
          <span>Import from Wiki</span>
          <ExternalLink className="h-4 w-4 opacity-70" />
        </ImportButton>
      </div>
    </motion.div>
  );
}