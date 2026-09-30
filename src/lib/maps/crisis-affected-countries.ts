type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * CrisisEvent.affectedCountries is a JSON array string of country IDs; legacy rows are
 * comma-separated (or a single bare country ID).
 */
export function parseAffectedCountries(raw: string | null | undefined): string[] {
  const text = raw?.trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as JsonValue;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
      }
    } catch {
      // malformed JSON: fall through to the comma split
    }
  }
  return text
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
