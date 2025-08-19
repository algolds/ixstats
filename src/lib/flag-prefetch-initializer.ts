// Flag Prefetch Initializer - Automatically starts background flag caching
// This runs once when the application starts to ensure flags are ready

import { unifiedFlagService } from './unified-flag-service';

let isInitialized = false;

/**
 * Initialize flag prefetching with all countries from the database
 * This should be called once when the application starts
 */
export async function initializeFlagPrefetching(): Promise<void> {
  if (isInitialized) {
    console.log('[FlagPrefetchInitializer] Already initialized, skipping');
    return;
  }

  try {
    console.log('[FlagPrefetchInitializer] Starting flag prefetch initialization...');
    
    // Only run in production server environment
    if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'production') {
      console.log('[FlagPrefetchInitializer] Skipping in non-production or client environment');
      return;
    }

    // Import API dynamically to avoid issues during build
    const { api } = await import('~/trpc/server');
    
    // Get all countries from database
    const countries = await api.countries.getAll({ limit: 1000 });
    const countryNames = countries.countries.map((c: any) => c.name);
    
    if (countryNames.length === 0) {
      console.warn('[FlagPrefetchInitializer] No countries found in database');
      return;
    }

    console.log(`[FlagPrefetchInitializer] Triggering background prefetch for ${countryNames.length} countries`);
    
    // Start background prefetching (non-blocking)
    unifiedFlagService.prefetchFlags(countryNames);
    
    isInitialized = true;
    console.log('[FlagPrefetchInitializer] Flag prefetch initialization completed');
    
  } catch (error) {
    console.error('[FlagPrefetchInitializer] Failed to initialize flag prefetching:', error);
  }
}

/**
 * Check if flag prefetching has been initialized
 */
export function isFlagPrefetchInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset initialization state (useful for testing)
 */
export function resetFlagPrefetchInitialization(): void {
  isInitialized = false;
}

// Auto-initialize in production server environment
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  // Use setTimeout to avoid blocking the main thread
  setTimeout(() => {
    initializeFlagPrefetching().catch(error => {
      console.error('[FlagPrefetchInitializer] Auto-initialization failed:', error);
    });
  }, 1000); // Wait 1 second after module load
}