export interface SpecialStats {
  force?: string;
  wealth?: string;
  influence?: string;
  legacy?: string;
}

/**
 * Compute special stats for a card based on its attributes.
 * Called lazily when `attributes.specials` is absent during formatting.
 */
export function computeSpecialStats(card: {
  cardType?: string | null;
  attributes?: Record<string, any> | null;
  nsData?: Record<string, any> | null;
  country?: { region?: string | null; population?: number | null } | null;
}): SpecialStats {
  const cardType = card.cardType ?? "";
  const attrs = card.attributes ?? {};
  const nsData = card.nsData ?? attrs.nationData ?? {};

  if (cardType === "NATION") {
    const pop = nsData.population ?? 0;
    // eslint-disable-next-line unused-imports/no-unused-vars
    const freedom = nsData.freedom ?? {};
    const economy = nsData.economy ?? "";
    const govType = attrs.governmentType ?? nsData.governmentType ?? "";

    const isAuthoritarian =
      /authoritarian|dictatorship|totalitarian|autocracy|tyranny|despotism/i.test(govType);
    const isDemocratic = /democracy|republic|federation|commonwealth/i.test(govType);

    return {
      force: pop > 5e9 ? "High" : pop > 1e9 ? "Medium" : "Low",
      wealth:
        economy.includes("frightening") || economy.includes("all-consuming") ? "High" : "Medium",
      influence: isAuthoritarian ? "High" : isDemocratic ? "Medium" : "Low",
      legacy: pop > 5e9 ? "Legendary" : pop > 1e9 ? "Significant" : "Growing",
    };
  }

  if (cardType === "LORE") {
    return {
      force: "Mystical",
      wealth: "Priceless",
      influence: "Cultural",
      legacy: "Eternal",
    };
  }

  if (cardType === "NS_IMPORT") {
    return {
      force: nsData.force ?? "Standard",
      wealth: nsData.wealth ?? "Standard",
      influence: nsData.influence ?? "Standard",
      legacy: nsData.legacy ?? "Developing",
    };
  }

  return {};
}
