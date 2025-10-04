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
 * Uses slug if available, falls back to ID
 */
export function getCountryPath(country: { slug?: string | null; id: string; name?: string }): string {
  if (country.slug) {
    return `/countries/${country.slug}`;
  }
  // Fallback: generate slug from name if available, otherwise use ID
  if (country.name) {
    return `/countries/${generateSlug(country.name)}`;
  }
  return `/countries/${country.id}`;
}
