// Wiki Commons Flag Service - ONLY uses Wiki Commons API, NO local files
// Completely replaces the local file system approach

import { ixnayWiki } from "./mediawiki-service";

export interface WikiCommonsSymbol {
  flagUrl: string | null;
  coatOfArmsUrl: string | null;
  error?: string;
}

export interface FlagServiceStats {
  totalRequested: number;
  successfulFlags: number;
  failedFlags: number;
  cachedFlags: number;
}

class WikiCommonsFlagService {
  private stats = {
    totalRequested: 0,
    successfulFlags: 0,
    failedFlags: 0,
    cachedFlags: 0,
  };

  /**
   * Get flag URL for a country using ONLY Wiki Commons API
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    if (!countryName?.trim()) {
      return null;
    }

    try {
      console.log(`[WikiCommonsFlagService] Getting flag URL for: ${countryName}`);
      this.stats.totalRequested++;

      // Check cache first
      const cachedUrl = ixnayWiki.getCachedFlagUrl(countryName);
      if (cachedUrl) {
        console.log(`[WikiCommonsFlagService] Using cached flag for ${countryName}: ${cachedUrl}`);
        this.stats.cachedFlags++;
        return cachedUrl;
      }

      // Fetch from Wiki Commons API
      const flagResult = await ixnayWiki.getFlagUrl(countryName);
      if (typeof flagResult === "string") {
        console.log(
          `[WikiCommonsFlagService] Successfully fetched flag for ${countryName}: ${flagResult}`
        );
        this.stats.successfulFlags++;
        return flagResult;
      }

      console.log(`[WikiCommonsFlagService] No flag found for ${countryName}:`, flagResult);
      this.stats.failedFlags++;
      return null;
    } catch (error) {
      console.error(`[WikiCommonsFlagService] Error getting flag for ${countryName}:`, error);
      this.stats.failedFlags++;
      return null;
    }
  }

  /**
   * Get coat of arms URL for a country using Wiki Commons API
   */
  async getCoatOfArmsUrl(countryName: string): Promise<string | null> {
    if (!countryName?.trim()) {
      return null;
    }

    try {
      console.log(`[WikiCommonsFlagService] Getting coat of arms for: ${countryName}`);

      // Get country infobox which may contain coat of arms info
      const infobox = await ixnayWiki.getCountryInfobox(countryName);
      if (infobox) {
        // Try various coat of arms fields
        const coatOfArmsFields = [
          infobox.image_coat,
          infobox.coat_of_arms,
          infobox["coat of arms"],
          infobox["image coat"],
          infobox["coa"],
        ];

        for (const field of coatOfArmsFields) {
          if (typeof field === "string" && field.trim()) {
            let cleanFileName = field.trim();

            // Remove File: prefix if present
            if (cleanFileName.toLowerCase().startsWith("file:")) {
              cleanFileName = cleanFileName.substring(5).trim();
            }

            // Get file URL from MediaWiki
            const fileUrl = await ixnayWiki.getFileUrl(cleanFileName);
            if (typeof fileUrl === "string") {
              console.log(
                `[WikiCommonsFlagService] Found coat of arms for ${countryName}: ${fileUrl}`
              );
              return fileUrl;
            }
          }
        }
      }

      // Try comprehensive coat of arms filename patterns
      const normalizedName = countryName.replace(/\s+/g, "_");
      const lowercaseName = countryName.toLowerCase();
      const titleCaseName = countryName.replace(/\b\w/g, (l) => l.toUpperCase());

      // Country-specific name mappings for coat of arms
      const countrySpecificPatterns: string[] = [];
      const lowerCountry = countryName.toLowerCase();

      if (lowerCountry.includes("russia") || lowerCountry === "russian federation") {
        countrySpecificPatterns.push(
          "Coat_of_arms_of_Russia.svg",
          "Coat_of_arms_of_Russia.png",
          "Arms_of_Russia.svg",
          "Arms_of_Russia.png",
          "Coat_of_arms_of_the_Russian_Federation.svg",
          "Coat_of_arms_of_the_Russian_Federation.png",
          "Russian_coat_of_arms.svg",
          "Russian_coat_of_arms.png"
        );
      }

      if (lowerCountry.includes("united states") || lowerCountry === "usa") {
        countrySpecificPatterns.push(
          "Great_Seal_of_the_United_States_(obverse).svg",
          "US-GreatSeal-Obverse.svg",
          "Seal_of_the_United_States.svg"
        );
      }

      if (lowerCountry.includes("united kingdom") || lowerCountry === "uk") {
        countrySpecificPatterns.push(
          "Royal_Coat_of_Arms_of_the_United_Kingdom.svg",
          "UK_Royal_Coat_of_Arms.svg"
        );
      }

      const coatOfArmsPatterns = [
        // Country-specific patterns first (highest priority)
        ...countrySpecificPatterns,

        // Standard patterns
        `Coat_of_arms_of_${countryName}.svg`,
        `Coat_of_arms_of_${countryName}.png`,
        `Coat_of_arms_of_${normalizedName}.svg`,
        `Coat_of_arms_of_${normalizedName}.png`,
        `Coat_of_arms_of_the_${countryName}.svg`,
        `Coat_of_arms_of_the_${countryName}.png`,

        // Alternative formats
        `${countryName}_coat_of_arms.svg`,
        `${countryName}_coat_of_arms.png`,
        `${normalizedName}_coat_of_arms.svg`,
        `${normalizedName}_coat_of_arms.png`,

        // Arms variations
        `Arms_of_${countryName}.svg`,
        `Arms_of_${countryName}.png`,
        `Arms_of_${normalizedName}.svg`,
        `Arms_of_${normalizedName}.png`,
        `Arms_of_the_${countryName}.svg`,
        `Arms_of_the_${countryName}.png`,

        // Short coat patterns
        `Coat_${countryName}.svg`,
        `Coat_${countryName}.png`,
        `Coat_${normalizedName}.svg`,
        `Coat_${normalizedName}.png`,

        // National variations
        `National_coat_of_arms_of_${countryName}.svg`,
        `National_coat_of_arms_of_${countryName}.png`,
        `${countryName}_national_coat_of_arms.svg`,
        `${countryName}_national_coat_of_arms.png`,

        // State/Government variations
        `State_coat_of_arms_of_${countryName}.svg`,
        `State_coat_of_arms_of_${countryName}.png`,
        `Government_coat_of_arms_of_${countryName}.svg`,
        `Government_coat_of_arms_of_${countryName}.png`,

        // Country-specific patterns that are common
        `${countryName} coat of arms.svg`,
        `${countryName} coat of arms.png`,
        `${countryName}CoatOfArms.svg`,
        `${countryName}CoatOfArms.png`,
        `CoA_${countryName}.svg`,
        `CoA_${countryName}.png`,

        // Lesser coat of arms
        `Lesser_coat_of_arms_of_${countryName}.svg`,
        `Lesser_coat_of_arms_of_${countryName}.png`,
        `Lesser_arms_of_${countryName}.svg`,
        `Lesser_arms_of_${countryName}.png`,

        // Case variations for difficult countries
        `Coat_of_arms_of_${titleCaseName}.svg`,
        `Coat_of_arms_of_${titleCaseName}.png`,
        `Arms_of_${titleCaseName}.svg`,
        `Arms_of_${titleCaseName}.png`,
      ];

      for (const pattern of coatOfArmsPatterns) {
        console.log(`[WikiCommonsFlagService] Trying coat of arms pattern: ${pattern}`);
        const fileUrl = await ixnayWiki.getFileUrl(pattern);
        if (typeof fileUrl === "string") {
          console.log(`[WikiCommonsFlagService] Found coat of arms via pattern: ${fileUrl}`);
          return fileUrl;
        }
      }

      console.log(`[WikiCommonsFlagService] No coat of arms found for ${countryName}`);
      return null;
    } catch (error) {
      console.error(
        `[WikiCommonsFlagService] Error getting coat of arms for ${countryName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get both flag and coat of arms for a country
   */
  async getCountrySymbols(countryName: string): Promise<WikiCommonsSymbol> {
    if (!countryName?.trim()) {
      return { flagUrl: null, coatOfArmsUrl: null, error: "No country name provided" };
    }

    try {
      console.log(`[WikiCommonsFlagService] Getting symbols for: ${countryName}`);

      // Fetch both in parallel
      const [flagUrl, coatOfArmsUrl] = await Promise.all([
        this.getFlagUrl(countryName),
        this.getCoatOfArmsUrl(countryName),
      ]);

      return {
        flagUrl,
        coatOfArmsUrl,
      };
    } catch (error) {
      console.error(`[WikiCommonsFlagService] Error getting symbols for ${countryName}:`, error);
      return {
        flagUrl: null,
        coatOfArmsUrl: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Batch get flags for multiple countries (Wiki Commons API only)
   */
  async batchGetFlags(countryNames: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};

    // Process in smaller batches to avoid overwhelming the API
    const BATCH_SIZE = 3;
    for (let i = 0; i < countryNames.length; i += BATCH_SIZE) {
      const batch = countryNames.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (countryName) => {
        try {
          const url = await this.getFlagUrl(countryName);
          results[countryName] = url;
        } catch (error) {
          console.error(`[WikiCommonsFlagService] Batch error for ${countryName}:`, error);
          results[countryName] = null;
        }
      });

      await Promise.allSettled(batchPromises);

      // Small delay between batches
      if (i + BATCH_SIZE < countryNames.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Get cached flag URL (synchronous, no network requests)
   */
  getCachedFlagUrl(countryName: string): string | null {
    return ixnayWiki.getCachedFlagUrl(countryName);
  }

  /**
   * Check if a URL is a placeholder
   */
  isPlaceholderFlag(url: string | null): boolean {
    if (!url) return true;
    return (
      url.includes("placeholder") || url.includes("default") || url.endsWith("placeholder-flag.svg")
    );
  }

  /**
   * Get service statistics
   */
  getStats(): FlagServiceStats {
    return {
      totalRequested: this.stats.totalRequested,
      successfulFlags: this.stats.successfulFlags,
      failedFlags: this.stats.failedFlags,
      cachedFlags: this.stats.cachedFlags,
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    ixnayWiki.clearCache();
    console.log("[WikiCommonsFlagService] Cache cleared");
  }

  /**
   * Clear cache for a specific country
   */
  clearCountryCache(countryName: string): void {
    ixnayWiki.clearCountryCache(countryName);
    console.log(`[WikiCommonsFlagService] Cache cleared for: ${countryName}`);
  }
}

// Export singleton instance
export const wikiCommonsFlagService = new WikiCommonsFlagService();
export default wikiCommonsFlagService;
