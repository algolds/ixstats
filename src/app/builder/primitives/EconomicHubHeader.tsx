"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { unifiedFlagService } from '~/lib/unified-flag-service';
import type { RealCountryData, EconomicInputs } from '../lib/economy-data-service';

// Get the original foundation country name for flag display
function getFoundationCountryName(referenceCountry: RealCountryData): string {
  if (referenceCountry.foundationCountryName) {
    return referenceCountry.foundationCountryName;
  }
  
  const name = referenceCountry.name;
  if (name.startsWith('New ')) {
    return name.substring(4);
  }
  
  return name;
}

interface EconomicHubHeaderProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onBack: () => void;
}

export function EconomicHubHeader({
  inputs,
  referenceCountry,
  onBack
}: EconomicHubHeaderProps) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  
  // Fetch foundation country flag for background
  useEffect(() => {
    const fetchFlag = async () => {
      const foundationCountryName = getFoundationCountryName(referenceCountry);
      if (!foundationCountryName) return;
      
      try {
        // Check cache first
        const cachedUrl = unifiedFlagService.getCachedFlagUrl(foundationCountryName);
        if (cachedUrl) {
          setFlagUrl(cachedUrl);
          console.log(`[EconomicHubHeader] Flag loaded from cache for ${foundationCountryName}:`, cachedUrl);
          return;
        }
        
        // Fetch if not cached
        const url = await unifiedFlagService.getFlagUrl(foundationCountryName);
        setFlagUrl(url);
        console.log(`[EconomicHubHeader] Flag loaded for ${foundationCountryName}:`, url);
      } catch (error) {
        console.error(`[EconomicHubHeader] Error loading flag for ${foundationCountryName}:`, error);
      }
    };
    
    fetchFlag();
  }, [referenceCountry.name, referenceCountry.foundationCountryName]);
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between mb-8 relative z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-lg p-4 border border-slate-200/30 dark:border-slate-700/30 overflow-hidden"
    >
      {/* Flag Background */}
      {flagUrl && (
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${flagUrl})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.25
          }}
        />
      )}
      
      {/* Overlay for blur effect and readability */}
      <div className="absolute inset-0 backdrop-filter backdrop-blur-md bg-white/60 dark:bg-black/60 z-10" />
      
      <div className="relative z-20 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={onBack}
              variant="outline"
              size="default"
              className="bg-white/20 dark:bg-slate-800/60 border-white/30 dark:border-slate-600/40 text-slate-800 dark:text-white hover:bg-white/30 dark:hover:bg-slate-700/70 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                Building: {inputs.countryName}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Foundation Country: {getFoundationCountryName(referenceCountry)} {referenceCountry.countryCode ? `(${referenceCountry.countryCode})` : ''}
              </p>
            </div>
          </div>
        </div>
        
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Customize your economic parameters below
        </p>
      </div>
    </motion.div>
  );
}