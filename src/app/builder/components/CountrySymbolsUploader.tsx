import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Shield, Image as ImageIcon, ChevronDown, Palette, Sparkles } from 'lucide-react';
import { cn } from '~/lib/utils';
import { extractColorsFromImage, generateImageThemeCSS, type ExtractedColors } from '~/lib/image-color-extractor';
import { getFlagColors } from '~/lib/flag-color-extractor';

interface CountrySymbolsUploaderProps {
  flagUrl: string;
  coatOfArmsUrl: string;
  foundationCountry?: {
    name: string;
    flagUrl?: string;
    coatOfArmsUrl?: string;
  } | null;
  onSelectFlag: () => void;
  onSelectCoatOfArms: () => void;
  onColorsExtracted?: (colors: ExtractedColors) => void;
}

export function CountrySymbolsUploader({ 
  flagUrl, 
  coatOfArmsUrl, 
  foundationCountry,
  onSelectFlag,
  onSelectCoatOfArms,
  onColorsExtracted
}: CountrySymbolsUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);

  // Extract colors when images change
  const extractColorsFromImages = useCallback(async () => {
    const imageToAnalyze = flagUrl || coatOfArmsUrl;
    if (!imageToAnalyze || isExtracting) return;

    setIsExtracting(true);
    try {
      const colors = await extractColorsFromImage(imageToAnalyze);
      setExtractedColors(colors);
      onColorsExtracted?.(colors);
      setShowColorPalette(true);
      
      // Auto-hide palette after 3 seconds
      setTimeout(() => setShowColorPalette(false), 3000);
    } catch (error) {
      console.warn('Failed to extract colors from image:', error);
      // Fallback to flag colors if extraction fails
      if (foundationCountry?.name) {
        const fallbackColors = getFlagColors(foundationCountry.name);
        setExtractedColors(fallbackColors);
        onColorsExtracted?.(fallbackColors);
      }
    } finally {
      setIsExtracting(false);
    }
  }, [flagUrl, coatOfArmsUrl, foundationCountry?.name, onColorsExtracted, isExtracting]);

  useEffect(() => {
    extractColorsFromImages();
  }, [extractColorsFromImages]);

  // Set default images from foundation country
  useEffect(() => {
    if (foundationCountry && !flagUrl && foundationCountry.flagUrl) {
      // Could trigger onSelectFlag with foundation country data
    }
  }, [foundationCountry, flagUrl]);

  return (
    <div className="pt-4 border-t border-white/10 relative z-10">
      {/* Foundation Country Info */}
      {foundationCountry && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Flag className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-white/90">
              Foundation: {foundationCountry.name}
            </span>
          </div>
          <p className="text-xs text-white/60">
            Default symbols and colors will be based on this country
          </p>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5"/>
          National Symbols
          {isExtracting && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Sparkles className="h-4 w-4 text-yellow-400" />
            </motion.div>
          )}
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown className="h-5 w-5"/>
        </motion.div>
      </button>

      {/* Color Palette Display */}
      <AnimatePresence>
        {showColorPalette && extractedColors && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 p-3 bg-white/5 rounded-lg border border-white/10"
          >
            <div className="flex items-center gap-2 mb-2">
              <Palette className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-white/90">Extracted Colors</span>
            </div>
            <div className="flex gap-2">
              <div 
                className="w-8 h-8 rounded border border-white/20" 
                style={{ backgroundColor: extractedColors.primary }}
                title={`Primary: ${extractedColors.primary}`}
              />
              <div 
                className="w-8 h-8 rounded border border-white/20" 
                style={{ backgroundColor: extractedColors.secondary }}
                title={`Secondary: ${extractedColors.secondary}`}
              />
              <div 
                className="w-8 h-8 rounded border border-white/20" 
                style={{ backgroundColor: extractedColors.accent }}
                title={`Accent: ${extractedColors.accent}`}
              />
            </div>
            <p className="text-xs text-white/60 mt-2">
              Colors automatically applied to UI theme
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                className="overflow-hidden"
            >
                <div className={cn(
                    "p-4 rounded-lg bg-slate-800/50",
                    isOpen ? "bg-white/5" : ""
                )}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Flag Section */}
                        <div className="space-y-4">
                        <label className="form-label flex items-center text-white/80">
                            <Flag className="h-4 w-4 mr-2 text-blue-400" />
                            Country Flag
                        </label>
                        <div className="w-full h-40 border border-white/20 rounded-md flex items-center justify-center overflow-hidden bg-black/20">
                            {flagUrl ? (
                            <img src={flagUrl} alt="Country Flag" className="object-contain max-h-full max-w-full" />
                            ) : foundationCountry?.flagUrl ? (
                            <div className="relative w-full h-full">
                              <img
                                src={foundationCountry.flagUrl}
                                alt={`${foundationCountry.name} Flag`}
                                className="object-cover w-full h-full"
                              />
                            </div>
                            ) : (
                            <span className="text-white/60 text-sm">No Flag Selected</span>
                            )}
                        </div>
                        <button
                            onClick={onSelectFlag}
                            className="w-full px-4 py-2 text-sm font-medium rounded-md transition-colors bg-blue-600/80 text-white hover:bg-blue-500/80"
                        >
                            <ImageIcon className="h-4 w-4 inline-block mr-2" /> Select Flag
                        </button>
                        </div>

                        {/* Coat of Arms Section */}
                        <div className="space-y-4">
                        <label className="form-label flex items-center text-white/80">
                            <Shield className="h-4 w-4 mr-2 text-purple-400" />
                            Coat of Arms
                        </label>
                        <div className="w-full h-40 border border-white/20 rounded-md flex items-center justify-center overflow-hidden bg-black/20">
                            {coatOfArmsUrl ? (
                            <img src={coatOfArmsUrl} alt="Coat of Arms" className="object-contain max-h-full max-w-full" />
                            ) : foundationCountry?.coatOfArmsUrl ? (
                            <div className="relative w-full h-full">
                              <img 
                                src={foundationCountry.coatOfArmsUrl} 
                                alt={`${foundationCountry.name} Coat of Arms`} 
                                className="object-contain max-h-full max-w-full opacity-50" 
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <span className="text-white/80 text-xs bg-black/50 px-2 py-1 rounded">
                                  Foundation Default
                                </span>
                              </div>
                            </div>
                            ) : (
                            <span className="text-white/60 text-sm">No Coat of Arms Selected</span>
                            )}
                        </div>
                        <button
                            onClick={onSelectCoatOfArms}
                            className="w-full px-4 py-2 text-sm font-medium rounded-md transition-colors bg-purple-600/80 text-white hover:bg-purple-500/80"
                        >
                            <ImageIcon className="h-4 w-4 inline-block mr-2" /> Select Coat of Arms
                        </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

