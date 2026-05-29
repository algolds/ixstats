"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { GlassCard, GlassCardContent } from "../glass/GlassCard";

// Dynamic import for heavy media search modal
const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);
import { CountrySymbolsUploader } from "../CountrySymbolsUploader";
import type { EconomicInputs, RealCountryData } from "~/app/builder/lib/economy-data-service";
import { useBuilderTheming } from "~/hooks/useBuilderTheming";
import { unifiedFlagService } from "~/lib/unified-flag-service";
import { wikiCommonsFlagService } from "~/lib/wiki-commons-flag-service";

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
  if (name.startsWith("New ")) {
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
  const [foundationFlagUrl, setFoundationFlagUrl] = useState<string | undefined>(
    referenceCountry?.flag || referenceCountry?.flagUrl || undefined
  ); // State for fetched flag URL
  const [foundationCoatOfArmsUrl, setFoundationCoatOfArmsUrl] = useState<string | undefined>(
    referenceCountry?.coatOfArms || referenceCountry?.coatOfArmsUrl || undefined
  ); // State for fetched coat of arms URL

  // Fetch foundation flag and coat of arms URLs using Wiki Commons API
  useEffect(() => {
    const fetchSymbols = async () => {
      // First check if referenceCountry already has both symbols
      const refFlag = referenceCountry?.flag || referenceCountry?.flagUrl;
      const refCoa = referenceCountry?.coatOfArms || referenceCountry?.coatOfArmsUrl;
      if (refFlag && refCoa) {
        setFoundationFlagUrl(refFlag);
        setFoundationCoatOfArmsUrl(refCoa);
        return;
      }

      // Get the stable foundation country name
      const foundationCountryName = getFoundationCountryName(referenceCountry);

      if (foundationCountryName) {
        try {
          // Fetch flag from unified service (cache-first) and coat of arms from wiki commons
          const [flagUrl, coatOfArmsResult] = await Promise.all([
            unifiedFlagService.getFlagUrl(foundationCountryName),
            wikiCommonsFlagService.getCoatOfArmsUrl(foundationCountryName),
          ]);

          if (flagUrl) {
            setFoundationFlagUrl(flagUrl);
          } else if (refFlag) {
            setFoundationFlagUrl(refFlag);
          }

          if (coatOfArmsResult) {
            setFoundationCoatOfArmsUrl(coatOfArmsResult);
          } else if (refCoa) {
            setFoundationCoatOfArmsUrl(refCoa);
          }
        } catch (error) {
          if (refFlag) setFoundationFlagUrl(refFlag);
          if (refCoa) setFoundationCoatOfArmsUrl(refCoa);
        }
      }
    };
    fetchSymbols();
  }, [referenceCountry]);

  // Auto-fill flag and coat of arms from foundation country when available
  useEffect(() => {
    const refFlag = referenceCountry?.flag || referenceCountry?.flagUrl;
    const activeFlag = foundationFlagUrl || refFlag;
    if (activeFlag && (!inputs.flagUrl || inputs.flagUrl === "")) {
      handleFlagUrlChange(activeFlag);
    }

    const refCoa = referenceCountry?.coatOfArms || referenceCountry?.coatOfArmsUrl;
    const activeCoa = foundationCoatOfArmsUrl || refCoa;
    if (activeCoa && (!inputs.coatOfArmsUrl || inputs.coatOfArmsUrl === "")) {
      handleCoatOfArmsUrlChange(activeCoa);
    }
  }, [
    foundationFlagUrl,
    foundationCoatOfArmsUrl,
    referenceCountry,
    inputs.flagUrl,
    inputs.coatOfArmsUrl,
  ]);

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
    handleSymbolsChange(url, inputs.coatOfArmsUrl ?? "");
  };

  const handleCoatOfArmsUrlChange = (url: string) => {
    handleSymbolsChange(inputs.flagUrl ?? "", url);
  };

  return (
    <>
      <div className="space-y-6">
        <CountrySymbolsUploader
          flagUrl={inputs.flagUrl ?? ""}
          coatOfArmsUrl={inputs.coatOfArmsUrl ?? ""}
          foundationCountry={{
            name: foundationCountryName, // Use the original foundation country name
            flagUrl: foundationFlagUrl,
            coatOfArmsUrl: foundationCoatOfArmsUrl, // Now dynamically fetched from Wiki Commons
          }}
          onSelectFlag={() => setShowFlagImageModal(true)}
          onSelectCoatOfArms={() => setShowCoatOfArmsImageModal(true)}
          onFlagUrlChange={handleFlagUrlChange}
          onCoatOfArmsUrlChange={handleCoatOfArmsUrlChange}
          onColorsExtracted={(colors) => {
            handleColorsExtracted(colors);
          }}
        />
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
