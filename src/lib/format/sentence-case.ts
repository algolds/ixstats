/** "EARN_BONUS" or "bonus:spring_event" to "Earn bonus" / "Bonus spring event". */
export function sentenceCase(raw: string): string {
  const plain = raw.replace(/[_:]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}
