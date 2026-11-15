/**
 * Up to three initials for a competition or club with no art of its own ("Premier Liga Ixnay" is "PLI").
 * Short joining words are skipped unless the name has nothing else.
 */
const JOINERS = new Set(["of", "the", "and", "de", "del", "la", "le", "da", "di", "do"]);

export function monogram(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const significant = words.filter((word) => !JOINERS.has(word.toLowerCase()));
  const source = significant.length > 0 ? significant : words;
  if (source.length === 1) return Array.from(source[0]!).slice(0, 2).join("").toUpperCase();
  return source
    .slice(0, 3)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
}
