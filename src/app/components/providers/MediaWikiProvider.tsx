// src/components/providers/MediaWikiProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "~/trpc/react";
import { ixnayWiki } from "~/lib/mediawiki-service";

interface MediaWikiContextValue {
  isPreloading: boolean;
  preloadProgress: number;
  isComplete: boolean;
  cacheStats: {
    flags: number;
    templates: number;
    infoboxes: number;
    wikiUrls: number;
    preloadedFlags: number;
  };
  error: string | null;
}

const MediaWikiContext = createContext<MediaWikiContextValue>({
  isPreloading: false,
  preloadProgress: 0,
  isComplete: false,
  cacheStats: {
    flags: 0,
    templates: 0,
    infoboxes: 0,
    wikiUrls: 0,
    preloadedFlags: 0
  },
  error: null
});

export function useMediaWikiContext() {
  return useContext(MediaWikiContext);
}

interface MediaWikiProviderProps {
  children: ReactNode;
}

export function MediaWikiProvider({ children }: MediaWikiProviderProps) {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState(ixnayWiki.getCacheStats());

  // Get countries data to start preloading
  const { data: countries } = api.countries.getAll.useQuery();

  useEffect(() => {
    const preloadMediaWikiData = async () => {
      if (!countries || countries.length === 0 || isComplete) return;

      console.log('[MediaWiki Provider] Starting preload for', countries.length, 'countries');
      
      setIsPreloading(true);
      setError(null);
      
      try {
        const countryNames = countries.map(c => c.name);
        let loadedCount = 0;
        
        // Preload flags with progress tracking
        const batchSize = 3; // Smaller batches for better progress updates
        
        for (let i = 0; i < countryNames.length; i += batchSize) {
          const batch = countryNames.slice(i, i + batchSize);
          
          const promises = batch.map(async (name) => {
            try {
              await ixnayWiki.getFlagUrl(name);
              loadedCount++;
              setPreloadProgress((loadedCount / countryNames.length) * 100);
              setCacheStats(ixnayWiki.getCacheStats());
            } catch (error) {
              console.warn(`[MediaWiki Provider] Failed to preload ${name}:`, error);
            }
          });
          
          await Promise.allSettled(promises);
          
          // Small delay to prevent overwhelming the server
          if (i + batchSize < countryNames.length) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }
        
        setIsComplete(true);
        console.log('[MediaWiki Provider] Preload completed');
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('[MediaWiki Provider] Preload failed:', err);
      } finally {
        setIsPreloading(false);
        setCacheStats(ixnayWiki.getCacheStats());
      }
    };

    // Start preloading after a small delay to not block initial render
    const timeoutId = setTimeout(preloadMediaWikiData, 500);
    
    return () => clearTimeout(timeoutId);
  }, [countries, isComplete]);

  // Update cache stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(ixnayWiki.getCacheStats());
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const contextValue: MediaWikiContextValue = {
    isPreloading,
    preloadProgress,
    isComplete,
    cacheStats,
    error
  };

  return (
    <MediaWikiContext.Provider value={contextValue}>
      {children}
    </MediaWikiContext.Provider>
  );
}

// Optional: Status indicator component
export function MediaWikiLoadingIndicator() {
  const { isPreloading, preloadProgress, isComplete, error } = useMediaWikiContext();

  if (!isPreloading && !error) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-[var(--color-surface-blur)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg p-3 shadow-lg max-w-xs">
        {error ? (
          <div className="flex items-center text-[var(--color-error)] text-sm">
            <span className="mr-2">⚠️</span>
            <span>Flag loading failed</span>
          </div>
        ) : isPreloading ? (
          <div className="space-y-2">
            <div className="flex items-center text-[var(--color-text-primary)] text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--color-brand-primary)] border-t-transparent mr-2"></div>
              <span>Loading flags...</span>
            </div>
            <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2">
              <div 
                className="bg-[var(--color-brand-primary)] h-2 rounded-full transition-all duration-300"
                style={{ width: `${preloadProgress}%` }}
              ></div>
            </div>
            <div className="text-xs text-[var(--color-text-muted)] text-center">
              {Math.round(preloadProgress)}%
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}