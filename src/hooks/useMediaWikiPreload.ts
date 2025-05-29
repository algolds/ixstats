// src/hooks/useMediaWikiPreload.ts
import { useEffect, useState } from "react";
import { ixnayWiki } from "~/lib/mediawiki-service";

interface PreloadStatus {
  isPreloading: boolean;
  flagsLoaded: number;
  totalFlags: number;
  isComplete: boolean;
  error: string | null;
}

interface UseMediaWikiPreloadOptions {
  autoStart?: boolean;
  batchSize?: number;
  delayBetweenBatches?: number;
}

export function useMediaWikiPreload(
  countryNames: string[],
  options: UseMediaWikiPreloadOptions = {}
) {
  const {
    autoStart = true,
    batchSize = 5,
    delayBetweenBatches = 100
  } = options;

  const [status, setStatus] = useState<PreloadStatus>({
    isPreloading: false,
    flagsLoaded: 0,
    totalFlags: countryNames.length,
    isComplete: false,
    error: null
  });

  const preloadData = async () => {
    if (countryNames.length === 0) return;

    setStatus(prev => ({
      ...prev,
      isPreloading: true,
      error: null,
      flagsLoaded: 0,
      totalFlags: countryNames.length
    }));

    try {
      // Load flags in batches with progress updates
      for (let i = 0; i < countryNames.length; i += batchSize) {
        const batch = countryNames.slice(i, i + batchSize);
        
        const promises = batch.map(async (name) => {
          try {
            await ixnayWiki.getFlagUrl(name);
            setStatus(prev => ({
              ...prev,
              flagsLoaded: prev.flagsLoaded + 1
            }));
          } catch (error) {
            console.warn(`[MediaWiki Preload] Failed to load flag for ${name}`);
          }
        });
        
        await Promise.allSettled(promises);
        
        // Small delay between batches to avoid overwhelming the server
        if (i + batchSize < countryNames.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      setStatus(prev => ({
        ...prev,
        isPreloading: false,
        isComplete: true
      }));

      console.log(`[MediaWiki Preload] Completed loading flags for ${countryNames.length} countries`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MediaWiki Preload] Error during preload:', error);
      
      setStatus(prev => ({
        ...prev,
        isPreloading: false,
        error: errorMessage
      }));
    }
  };

  useEffect(() => {
    if (autoStart && countryNames.length > 0) {
      // Small delay to avoid blocking initial render
      const timeoutId = setTimeout(preloadData, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [countryNames, autoStart]);

  return {
    ...status,
    preloadData,
    getCacheStats: () => ixnayWiki.getCacheStats(),
    clearCache: () => ixnayWiki.clearCache()
  };
}

// Utility hook for global app-wide preloading
export function useGlobalMediaWikiPreload() {
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeMediaWikiCache = async (countryNames: string[]) => {
    if (isInitialized || countryNames.length === 0) return;

    setIsInitialized(true);
    
    try {
      console.log('[Global MediaWiki] Starting background preload...');
      
      // Start preloading in the background without blocking
      ixnayWiki.preloadFlags(countryNames).then(() => {
        console.log('[Global MediaWiki] Background preload completed');
      }).catch((error) => {
        console.warn('[Global MediaWiki] Background preload failed:', error);
      });
      
    } catch (error) {
      console.error('[Global MediaWiki] Failed to initialize cache:', error);
    }
  };

  return {
    initializeMediaWikiCache,
    isInitialized,
    getCacheStats: () => ixnayWiki.getCacheStats()
  };
}