// src/lib/wiki-os/safe-decode.ts
// Safe decodeURIComponent wrapper — handles malformed percent-encoded URIs
// that originate from MediaWiki/Parsoid HTML with edge-case character sequences.

export function safeDecodeURI(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    // Attempt to clean common encoding issues
    try {
      return decodeURIComponent(str.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
    } catch {
      // Last resort: return raw
      return str;
    }
  }
}
