/**
 * Groups a country's diplomatic events into per-counterparty incident strings
 * for the relationship ledger. Pure + testable; the router does the DB read.
 */
export interface DiplomaticEventLite {
  country1Id: string;
  country2Id: string | null;
  eventType: string;
  title: string;
  severity: string;
}

/**
 * @param events  events where selfId is country1 or country2, newest first
 * @param selfId  the viewing country
 * @param perCountry  max incidents kept per counterparty (default 5)
 * @returns map of counterpartyId -> short incident strings (newest first)
 */
export function groupIncidentsByCountry(
  events: DiplomaticEventLite[],
  selfId: string,
  perCountry = 5
): Map<string, string[]> {
  const byCountry = new Map<string, string[]>();
  for (const ev of events) {
    const other = ev.country1Id === selfId ? ev.country2Id : ev.country1Id;
    if (!other || other === selfId) continue;
    const list = byCountry.get(other) ?? [];
    if (list.length < perCountry) {
      const sev = ev.severity && ev.severity !== "info" ? `[${ev.severity}] ` : "";
      list.push(`${sev}${ev.title}`);
    }
    byCountry.set(other, list);
  }
  return byCountry;
}
