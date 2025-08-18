"use client";

import React, { useState, useEffect } from 'react';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../glass/GlassCard';
import { Button } from '~/components/ui/button';
import { Image as ImageIcon } from 'lucide-react';
import { MediaSearchModal } from '~/components/thinkpages/MediaSearchModal';
import { CountrySymbolsUploader } from '../CountrySymbolsUploader';
import type { EconomicInputs, RealCountryData } from '~/app/builder/lib/economy-data-service';
import { useBuilderTheming } from '~/hooks/useBuilderTheming';
import { wikiCommonsFlagService } from '~/lib/wiki-commons-flag-service';

interface NationalSymbolsSectionProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry: RealCountryData;
}

// Get the original foundation country name for Wiki Commons API calls
function getFoundationCountryName(referenceCountry: RealCountryData): string {
  // First priority: use the preserved foundationCountryName if available
  if (referenceCountry.foundationCountryName) {
    return referenceCountry.foundationCountryName;
  }
  
  // Fallback: extract from "New [Country]" format for backwards compatibility
  const name = referenceCountry.name;
  if (name.startsWith('New ')) {
    return name.substring(4); // Remove "New " prefix
  }
  
  // Last resort: use the name as-is
  return name;
}

export function NationalSymbolsSection({
  inputs,
  onInputsChange,
  referenceCountry,
}: NationalSymbolsSectionProps) {
  const [showFlagImageModal, setShowFlagImageModal] = useState(false);
  const [showCoatOfArmsImageModal, setShowCoatOfArmsImageModal] = useState(false);
  const [foundationFlagUrl, setFoundationFlagUrl] = useState<string | undefined>(undefined); // State for fetched flag URL
  const [foundationCoatOfArmsUrl, setFoundationCoatOfArmsUrl] = useState<string | undefined>(undefined); // State for fetched coat of arms URL

  // Fetch foundation flag and coat of arms URLs using Wiki Commons API
  useEffect(() => {
    const fetchSymbols = async () => {
      // Get the stable foundation country name
      const foundationCountryName = getFoundationCountryName(referenceCountry);
      
      if (foundationCountryName) {
        console.log(`[NationalSymbolsSection] DEBUG - Reference Country:`, referenceCountry);
        console.log(`[NationalSymbolsSection] DEBUG - Inputs countryName: ${inputs.countryName}`);
        console.log(`[NationalSymbolsSection] DEBUG - Corrupted referenceCountry.name: ${referenceCountry.name}`);
        console.log(`[NationalSymbolsSection] DEBUG - Preserved foundationCountryName: ${referenceCountry.foundationCountryName || 'not available'}`);
        console.log(`[NationalSymbolsSection] DEBUG - Final foundation country name: ${foundationCountryName}`);
        console.log(`[NationalSymbolsSection] Fetching symbols for foundation country: ${foundationCountryName}`);
        
        try {
          // Fetch both flag and coat of arms in parallel using the original foundation country name
          const symbols = await wikiCommonsFlagService.getCountrySymbols(foundationCountryName);
          
          if (symbols.flagUrl) {
            setFoundationFlagUrl(symbols.flagUrl);
            console.log(`[NationalSymbolsSection] Found foundation flag: ${symbols.flagUrl}`);
          } else {
            setFoundationFlagUrl(undefined);
            console.log(`[NationalSymbolsSection] No foundation flag found for ${foundationCountryName}`);
          }

          if (symbols.coatOfArmsUrl) {
            setFoundationCoatOfArmsUrl(symbols.coatOfArmsUrl);
            console.log(`[NationalSymbolsSection] Found foundation coat of arms: ${symbols.coatOfArmsUrl}`);
          } else {
            setFoundationCoatOfArmsUrl(undefined);
            console.log(`[NationalSymbolsSection] No foundation coat of arms found for ${foundationCountryName}`);
          }

          if (symbols.error) {
            console.error(`[NationalSymbolsSection] Error fetching symbols for ${foundationCountryName}:`, symbols.error);
          }
        } catch (error) {
          console.error(`[NationalSymbolsSection] Exception fetching symbols for ${foundationCountryName}:`, error);
          setFoundationFlagUrl(undefined);
          setFoundationCoatOfArmsUrl(undefined);
        }
      }
    };
    fetchSymbols();
  }, [referenceCountry.name, referenceCountry.countryCode]);

  // Enhanced theming for this section (use original foundation country name)
  const foundationCountryName = getFoundationCountryName(referenceCountry);
  const { handleColorsExtracted } = useBuilderTheming(foundationCountryName);

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
              name: foundationCountryName, // Use the original foundation country name
              flagUrl: foundationFlagUrl,
              coatOfArmsUrl: foundationCoatOfArmsUrl // Now dynamically fetched from Wiki Commons
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
