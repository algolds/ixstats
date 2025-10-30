// Debug utility to test flag loading
import { flagService } from "./flag-service";

export async function debugFlagLoading() {
  console.log("[FlagDebug] Testing flag loading for sample countries...");

  const testCountries = ["Caphiria", "Daxia", "Caracua"];

  for (const country of testCountries) {
    console.log(`[FlagDebug] Testing ${country}...`);

    // Check cache first
    const cached = flagService.getCachedFlagUrl(country);
    console.log(`[FlagDebug] ${country} cached:`, cached);

    // Try to load
    try {
      const url = await flagService.getFlagUrl(country);
      console.log(`[FlagDebug] ${country} loaded:`, url);

      // Test if the URL is accessible
      if (url) {
        try {
          const response = await fetch(url, { method: "HEAD" });
          console.log(`[FlagDebug] ${country} URL status:`, response.status, response.statusText);
        } catch (error) {
          console.error(`[FlagDebug] ${country} URL test failed:`, error);
        }
      }
    } catch (error) {
      console.error(`[FlagDebug] ${country} loading failed:`, error);
    }
  }
}

// Auto-run debug if in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // Add to global scope for console testing
  (window as any).debugFlagLoading = debugFlagLoading;
}
