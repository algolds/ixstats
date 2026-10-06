import "server-only";

import { heroCardInputs, mayNameCountry } from "~/lib/wiki-os/hero-card";
import { api } from "~/trpc/server";

/**
 * Reads what the hero card is made from (lib/wiki-os/hero-card.ts) into this request's query cache,
 * so it is in the first HTML and in the cache the client hydrates: the card has its final shape
 * from the first paint instead of growing (breadcrumb, badge) and changing its backdrop and shape
 * (country flag) after hydration. One attempt each, no retries: a read that fails leaves the client
 * to ask, as before (`prefetch` never throws).
 */
export async function prefetchHeroCard(title: string): Promise<void> {
  const inputs = heroCardInputs(title);
  await Promise.all([
    api.wikios.getParentCategories.prefetch(inputs.parentCategories, { retry: false }),
    api.lorewards.getArticleAwardsAndAchievements.prefetch(inputs.awards, { retry: false }),
    mayNameCountry(title)
      ? api.countries.getByIdBasic.prefetch(inputs.country, { retry: false })
      : undefined,
  ]);
}
