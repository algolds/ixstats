"use client";

import { useEffect, useState, useCallback } from 'react';
import { generateImageThemeCSS, type ExtractedColors } from '~/lib/image-color-extractor';
import { getFlagColors, generateFlagThemeCSS } from '~/lib/flag-color-extractor';

interface ThemeState {
  colors: ExtractedColors | null;
  isApplied: boolean;
  isExtracting: boolean;
}

export function useBuilderTheming(foundationCountryName?: string) {
  const [themeState, setThemeState] = useState<ThemeState>({
    colors: null,
    isApplied: false,
    isExtracting: false
  });

  // Apply theme colors to the document root
  const applyTheme = useCallback((colors: ExtractedColors) => {
    const root = document.documentElement;
    const cssVars = generateImageThemeCSS(colors);
    
    // Apply CSS variables
    Object.entries(cssVars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Add theme class
    root.classList.add('builder-themed');
    
    setThemeState(prev => ({ ...prev, colors, isApplied: true }));
  }, []);

  // Remove theme from document root
  const removeTheme = useCallback(() => {
    const root = document.documentElement;
    
    // Remove theme class
    root.classList.remove('builder-themed');
    
    // Remove CSS variables
    const cssVars = generateImageThemeCSS(themeState.colors || {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#06b6d4',
      rgbPrimary: { r: 99, g: 102, b: 241 },
      rgbSecondary: { r: 139, g: 92, b: 246 },
      rgbAccent: { r: 6, g: 182, b: 212 }
    });
    
    Object.keys(cssVars).forEach((property) => {
      root.style.removeProperty(property);
    });
    
    setThemeState(prev => ({ ...prev, isApplied: false }));
  }, [themeState.colors]);

  // Apply foundation country theme
  const applyFoundationTheme = useCallback((countryName: string) => {
    setThemeState(prev => ({ ...prev, isExtracting: true }));
    
    try {
      const flagColors = getFlagColors(countryName);
      const extractedColors: ExtractedColors = {
        primary: flagColors.primary,
        secondary: flagColors.secondary,
        accent: flagColors.accent,
        rgbPrimary: flagColors.rgbPrimary,
        rgbSecondary: flagColors.rgbSecondary,
        rgbAccent: flagColors.rgbAccent
      };
      
      applyTheme(extractedColors);
    } catch (error) {
      console.warn('Failed to apply foundation theme:', error);
    } finally {
      setThemeState(prev => ({ ...prev, isExtracting: false }));
    }
  }, [applyTheme]);

  // Handle extracted colors from images
  const handleColorsExtracted = useCallback((colors: ExtractedColors) => {
    applyTheme(colors);
  }, [applyTheme]);

  // Apply foundation theme on mount if available
  useEffect(() => {
    if (foundationCountryName && !themeState.colors) {
      applyFoundationTheme(foundationCountryName);
    }
  }, [foundationCountryName, themeState.colors, applyFoundationTheme]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (themeState.isApplied) {
        removeTheme();
      }
    };
  }, []);

  return {
    themeColors: themeState.colors,
    isThemeApplied: themeState.isApplied,
    isExtracting: themeState.isExtracting,
    applyTheme,
    removeTheme,
    applyFoundationTheme,
    handleColorsExtracted
  };
}

export default useBuilderTheming;