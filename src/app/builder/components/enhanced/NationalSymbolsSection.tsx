"use client";

import React, { useState, useEffect } from 'react';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../glass/GlassCard';
import { Button } from '~/components/ui/button';
import { Image as ImageIcon } from 'lucide-react';
import { MediaSearchModal } from '~/components/thinkpages/MediaSearchModal';
import { CountrySymbolsUploader } from '../CountrySymbolsUploader';
import type { EconomicInputs, RealCountryData } from '~/app/builder/lib/economy-data-service';
import { useBuilderTheming } from '~/hooks/useBuilderTheming';
import { IxnayWikiService } from '~/lib/mediawiki-service';

interface NationalSymbolsSectionProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry: RealCountryData;
  onFoundationFlagUrlChange: (url: string | undefined) => void;
}

const ixnayWikiService = new IxnayWikiService(); // Create an instance of the service

export function NationalSymbolsSection({
  inputs,
  onInputsChange,
  referenceCountry,
  onFoundationFlagUrlChange,
}: NationalSymbolsSectionProps) {
  const [showFlagImageModal, setShowFlagImageModal] = useState(false);
  const [showCoatOfArmsImageModal, setShowCoatOfArmsImageModal] = useState(false);
  const [foundationFlagUrl, setFoundationFlagUrl] = useState<string | undefined>(undefined); // State for fetched flag URL

  // Fetch foundation flag URL using IxnayWikiService
  useEffect(() => {
    const fetchFlag = async () => {
      if (referenceCountry.name) {
        const url = await ixnayWikiService.getFlagUrl(referenceCountry.name);
        if (typeof url === 'string') {
          setFoundationFlagUrl(url);
          onFoundationFlagUrlChange(url);
        } else {
          setFoundationFlagUrl(undefined); // Explicitly set to undefined if WikiService fails
          onFoundationFlagUrlChange(undefined);
        }
      }
    };
    fetchFlag();
  }, [referenceCountry.name, referenceCountry.countryCode, onFoundationFlagUrlChange]);

  // Enhanced theming for this section
  const { handleColorsExtracted } = useBuilderTheming(referenceCountry.name);

  const handleSymbolsChange = (flagUrl: string, coatOfArmsUrl: string) => {
    onInputsChange({
      ...inputs,
      flagUrl,
      coatOfArmsUrl,
    });
  };

  const handleFlagUrlChange = (url: string) => {
    handleSymbolsChange(url, inputs.coatOfArmsUrl ?? '');
  };

  const handleCoatOfArmsUrlChange = (url: string) => {
    handleSymbolsChange(inputs.flagUrl ?? '', url);
  };

  return (
    <div className="space-y-6">
      <GlassCard depth="elevated" blur="medium">
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-[var(--color-text-primary)]" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">National Symbols</h3>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <CountrySymbolsUploader
            flagUrl={inputs.flagUrl ?? ''}
            coatOfArmsUrl={inputs.coatOfArmsUrl ?? ''}
            foundationCountry={{
              name: referenceCountry.name,
              flagUrl: foundationFlagUrl,
              coatOfArmsUrl: undefined // No direct mapping in RealCountryData for COA
            }}
            onSelectFlag={() => setShowFlagImageModal(true)}
            onSelectCoatOfArms={() => setShowCoatOfArmsImageModal(true)}
            onColorsExtracted={(colors) => {
              handleColorsExtracted(colors);
            }}
          />

          {showFlagImageModal && (
            <MediaSearchModal
              isOpen={showFlagImageModal}
              onClose={() => setShowFlagImageModal(false)}
              onImageSelect={(url) => {
                handleFlagUrlChange(url);
                setShowFlagImageModal(false);
              }}
            />
          )}
          {showCoatOfArmsImageModal && (
            <MediaSearchModal
              isOpen={showCoatOfArmsImageModal}
              onClose={() => setShowCoatOfArmsImageModal(false)}
              onImageSelect={(url) => {
                handleCoatOfArmsUrlChange(url);
                setShowCoatOfArmsImageModal(false);
              }}
            />
          )}
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
