"use client";

import React, { useState, useEffect } from 'react';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../glass/GlassCard';
import { Button } from '~/components/ui/button';
import { Image as ImageIcon } from 'lucide-react';
import { MediaSearchModal } from '~/components/MediaSearchModal';
import { CountrySymbolsUploader } from '../CountrySymbolsUploader';
import type { EconomicInputs, RealCountryData } from '~/app/builder/lib/economy-data-service';
import { useBuilderTheming } from '~/hooks/useBuilderTheming';
import { unifiedFlagService } from '~/lib/unified-flag-service';
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
        try {
          // Fetch flag from unified service (cache-first) and coat of arms from wiki commons
          const [flagUrl, coatOfArmsResult] = await Promise.all([
            unifiedFlagService.getFlagUrl(foundationCountryName),
            wikiCommonsFlagService.getCoatOfArmsUrl(foundationCountryName)
          ]);
          
          if (flagUrl) {
            setFoundationFlagUrl(flagUrl);
          } else {
            setFoundationFlagUrl(undefined);
          }

          if (coatOfArmsResult) {
            setFoundationCoatOfArmsUrl(coatOfArmsResult);
          } else {
            setFoundationCoatOfArmsUrl(undefined);
          }

        } catch (error) {
          setFoundationFlagUrl(undefined);
          setFoundationCoatOfArmsUrl(undefined);
        }
      }
    };
    fetchSymbols();
  }, [referenceCountry.name, referenceCountry.countryCode]);

  // Auto-fill flag and coat of arms from foundation country when available
  useEffect(() => {
    if (foundationFlagUrl && (!inputs.flagUrl || inputs.flagUrl === '')) {
      handleFlagUrlChange(foundationFlagUrl);
    }
    if (foundationCoatOfArmsUrl && (!inputs.coatOfArmsUrl || inputs.coatOfArmsUrl === '')) {
      handleCoatOfArmsUrlChange(foundationCoatOfArmsUrl);
    }
  }, [foundationFlagUrl, foundationCoatOfArmsUrl, inputs.flagUrl, inputs.coatOfArmsUrl]);

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
    <>
      <div className="space-y-6">
        <GlassCard depth="elevated" blur="medium">
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
              onFlagUrlChange={handleFlagUrlChange}
              onCoatOfArmsUrlChange={handleCoatOfArmsUrlChange}
              onColorsExtracted={(colors) => {
                handleColorsExtracted(colors);
              }}
            />
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Modal components outside the main layout */}
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
    </>
  );
}
