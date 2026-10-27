/**
 * Generate an original description for an NS-import card.
 *
 * Deliberately does NOT reproduce NationStates-authored card description
 * text (© Max Barry). Only factual metadata and the nation's own motto /
 * slogan (user-submitted content) are used, so the text is original.
 */
export function generateNSImportDescription(nsCard: {
  slogan?: string | null;
  motto?: string | null;
  category?: string | null;
  cardcategory?: string | null;
  govt?: string | null;
  region?: string | null;
}): string {
  const quote = (nsCard.slogan || nsCard.motto || "").trim();
  const facts = [
    nsCard.govt?.trim(),
    nsCard.cardcategory?.trim() || nsCard.category?.trim(),
    nsCard.region?.trim() ? `based in ${nsCard.region.trim()}` : null,
  ].filter((f): f is string => !!f);

  const bits: string[] = [];
  if (quote) bits.push(`"${quote}"`);
  if (facts.length > 0) bits.push(facts.join(" · "));
  return bits.join(" — ") || "A NationStates import card.";
}
