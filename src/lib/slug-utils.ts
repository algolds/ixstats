/**
 * Utility functions for generating URL-safe slugs from country names
 */

/**
 * Convert a country name to a URL-safe slug
 * @param name - The country name
 * @returns URL-safe slug (lowercase, hyphenated)
 *
 * @example
 * generateSlug("Caphiria") // "caphiria"
 * generateSlug("New Zealand") // "new-zealand"
 * generateSlug("São Tomé and Príncipe") // "sao-tome-and-principe"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Replace accented characters with ASCII equivalents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Get the display URL path for a country
 * Uses pretty /nation/ URLs with slug
 */
export function getCountryPath(country: { slug?: string | null; id: string; name?: string }): string {
  if (country.slug) {
    return `/nation/${country.slug}`;
  }
  // Fallback: generate slug from name if available
  if (country.name) {
    return `/nation/${generateSlug(country.name)}`;
  }
  // Last resort: use ID with /countries/ (legacy)
  return `/countries/${country.id}`;
}

/**
 * Get a nation URL from a country name
 * Convenience function for direct name-to-URL conversion
 */
export function getNationUrl(countryName: string): string {
  return `/nation/${generateSlug(countryName)}`;
}
