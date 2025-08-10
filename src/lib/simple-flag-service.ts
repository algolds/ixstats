// Simple, reliable flag service - no complex caching or APIs
"use client";

interface FlagCache {
  [countryName: string]: string | null;
}

class SimpleFlagService {
  private cache: FlagCache = {};
  private readonly PLACEHOLDER_FLAG = '/placeholder-flag.svg';

  /**
   * Get flag URL for a country - simple approach
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    if (!countryName) return null;

    // Check cache first
    if (this.cache[countryName] !== undefined) {
      return this.cache[countryName];
    }

    try {
      // Try to get flag from ixwiki.com via a simple fetch
      const apiUrl = `https://ixwiki.com/api.php?action=query&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(countryName)}&prop=revisions&rvprop=content&rvslots=main&rvsection=0`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'IxStats/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const pages = data.query?.pages || [];
      
      if (pages.length > 0 && pages[0].revisions?.[0]?.slots?.main?.content) {
        const content = pages[0].revisions[0].slots.main.content;
        
        // Simple regex to extract flag filename from infobox
        const flagMatch = content.match(/\|\s*(?:flag|image_flag)\s*=\s*([^\|\}\n]+)/i);
        if (flagMatch) {
          let flagFilename = flagMatch[1].trim();
          
          // Clean up the filename
          flagFilename = flagFilename.replace(/^\[\[File:/, '').replace(/\]\]$/, '');
          flagFilename = flagFilename.replace(/^\[\[/, '').replace(/\]\]$/, '');
          flagFilename = flagFilename.replace(/^File:/, '');
          
          if (flagFilename && !flagFilename.includes('{{') && !flagFilename.includes('|')) {
            // Get the actual image URL by querying the file info
            try {
              const fileInfoUrl = `https://ixwiki.com/api.php?action=query&format=json&formatversion=2&origin=*&titles=File:${encodeURIComponent(flagFilename)}&prop=imageinfo&iiprop=url`;
              const fileResponse = await fetch(fileInfoUrl);
              const fileData = await fileResponse.json();
              
              if (fileData.query?.pages?.[0]?.imageinfo?.[0]?.url) {
                const imageUrl = fileData.query.pages[0].imageinfo[0].url;
                // Cache and return the direct image URL
                this.cache[countryName] = imageUrl;
                return imageUrl;
              }
            } catch (fileError) {
              console.warn(`[SimpleFlagService] Failed to get file info for ${flagFilename}:`, fileError);
            }
          }
        }
      }

      // No flag found, cache null
      this.cache[countryName] = null;
      return null;

    } catch (error) {
      console.warn(`[SimpleFlagService] Failed to fetch flag for ${countryName}:`, error);
      // Cache null to avoid repeated failures
      this.cache[countryName] = null;
      return null;
    }
  }

  /**
   * Get cached flag URL (synchronous)
   */
  getCachedFlagUrl(countryName: string): string | null {
    return this.cache[countryName] ?? null;
  }

  /**
   * Check if a URL is a placeholder
   */
  isPlaceholderFlag(url: string): boolean {
    return url === this.PLACEHOLDER_FLAG || url.includes('placeholder');
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    const cached = Object.keys(this.cache).length;
    const successful = Object.values(this.cache).filter(url => url !== null).length;
    return {
      cached,
      successful,
      failed: cached - successful
    };
  }

  /**
   * Check if a flag is stored locally (always false for this simple service)
   */
  hasLocalFlag(countryName: string): boolean {
    return false;
  }

  /**
   * Initialize the service (compatibility method)
   */
  async initialize(countryNames?: string[]): Promise<void> {
    // Simple service doesn't need initialization
    return Promise.resolve();
  }

  /**
   * Get service stats (compatibility method)
   */
  getStats() {
    return this.getCacheStats();
  }

  /**
   * Batch get flags for multiple countries
   */
  async batchGetFlags(countryNames: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    
    // Use Promise.allSettled to handle all requests concurrently
    // This will run all requests in parallel for better performance
    const promises = countryNames.map(async (countryName) => {
      try {
        const flagUrl = await this.getFlagUrl(countryName);
        return { countryName, flagUrl };
      } catch (error) {
        console.warn(`[SimpleFlagService] Failed to get flag for ${countryName}:`, error);
        return { countryName, flagUrl: null };
      }
    });

    const settledResults = await Promise.allSettled(promises);
    
    // Process results
    settledResults.forEach((result, index) => {
      const countryName = countryNames[index];
      if (!countryName) return; // Skip if countryName is undefined
      
      if (result.status === 'fulfilled' && result.value) {
        results[result.value.countryName] = result.value.flagUrl;
      } else {
        results[countryName] = null;
      }
    });

    return results;
  }
}

// Export singleton instance
export const simpleFlagService = new SimpleFlagService();
export default simpleFlagService;