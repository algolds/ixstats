"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, ArrowLeft, Check, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createUrl } from '~/lib/url-utils';
import { EnhancedCountryFlag } from '~/components/ui/enhanced-country-flag';
import { useCountryFlagRouteAware } from '~/hooks/useCountryFlagRouteAware';
import { MyCountryLogo } from '~/components/ui/mycountry-logo';
import { SectionHeader, EmphasisText } from '~/components/ui/text-hierarchy';
import { ImportButton } from '~/components/ui/glass-button';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import type { RealCountryData } from '../lib/economy-data-service';
import { Highlighter } from "@/components/magicui/highlighter";
import { Globe } from '~/components/magicui/globe';
import { getOptimalTextStyling } from '~/lib/flag-color-analysis';

// Help modal component for Foundation step
function FoundationHelpModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Foundation Step Help
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overview */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                What is Foundation?
              </h3>
              <p className="text-sm text-muted-foreground">
                The Foundation step is where you select a real country as your starting point. 
                This provides baseline economic data, demographics, and cultural context for your nation.
              </p>
            </div>

            {/* Why Foundation Matters */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-blue-500" />
                Why Foundation Matters
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• <strong>Real Data:</strong> Starting with actual economic indicators</li>
                <li>• <strong>Cultural Context:</strong> Understanding regional characteristics</li>
                <li>• <strong>Baseline Metrics:</strong> GDP, population, currency, etc.</li>
                <li>• <strong>Realistic Starting Point:</strong> Build from proven foundations</li>
              </ul>
            </div>
          </div>

          {/* How to Choose */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Download className="h-4 w-4 text-purple-500" />
              How to Choose Your Foundation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                  <div>
                    <h4 className="font-medium">Consider Your Vision</h4>
                    <p className="text-sm text-muted-foreground">What type of nation do you want to build? Choose a foundation that aligns with your goals.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <div>
                    <h4 className="font-medium">Economic Similarity</h4>
                    <p className="text-sm text-muted-foreground">Look for countries with similar economic structures to your desired outcome.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                  <div>
                    <h4 className="font-medium">Geographic Context</h4>
                    <p className="text-sm text-muted-foreground">Consider regional factors, climate, and natural resources.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">4</div>
                  <div>
                    <h4 className="font-medium">Development Level</h4>
                    <p className="text-sm text-muted-foreground">Choose a development level that matches your starting vision.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Foundation Data */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 text-indigo-500" />
              What You Get from Foundation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: "Economic Data", items: ["GDP", "Currency", "Trade Balance", "Inflation"] },
                { title: "Demographics", items: ["Population", "Age Distribution", "Urban/Rural Split"] },
                { title: "Infrastructure", items: ["Transportation", "Education", "Healthcare Systems"] }
              ].map((section, index) => (
                <div key={index} className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">{section.title}</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {section.items.map((item, itemIndex) => (
                      <li key={itemIndex}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-amber-500" />
              Foundation Tips
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Good Choices
                </h4>
                <ul className="text-sm text-green-700 mt-2 space-y-1">
                  <li>• Countries with stable economies</li>
                  <li>• Nations with clear cultural identity</li>
                  <li>• Regions with good data availability</li>
                </ul>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium text-amber-800 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Considerations
                </h4>
                <ul className="text-sm text-amber-700 mt-2 space-y-1">
                  <li>• You can modify everything later</li>
                  <li>• Foundation is just a starting point</li>
                  <li>• Focus on your end vision</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CountrySelectorHeaderProps {
  softSelectedCountry: RealCountryData | null;
  onBackToIntro?: () => void;
}

export function CountrySelectorHeader({ softSelectedCountry, onBackToIntro }: CountrySelectorHeaderProps) {
  const router = useRouter();
  const { flag } = useCountryFlagRouteAware(softSelectedCountry?.foundationCountryName || softSelectedCountry?.name || '');
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
                <div className="flex items-center gap-3">
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
                  <FoundationHelpModal />
                </div>
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