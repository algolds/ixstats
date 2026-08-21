// src/server/shared/ixstats-template-provider.ts
// IxStats host-app template data provider for WikiOS (Workstream C4).
// Resolves CountryData, MyCountry, and BusinessData via canonical placeholder resolver.

import { prisma } from "~/server/db";
import type {
  TemplateDataProvider,
  TemplateKey,
  ResolvedTemplate,
  ResolveOptions,
} from "~/lib/wiki-os/template-resolver";
import { resolveWikiPlaceholderValues } from "./wiki-placeholders";

export const ixstatsTemplateProvider: TemplateDataProvider = {
  name: "ixstats-game-data",
  canHandle(category: string): boolean {
    const cat = category.toLowerCase();
    return cat === "mycountry" || cat === "countrydata" || cat === "businessdata";
  },
  async resolve(
    keys: readonly TemplateKey[],
    opts: ResolveOptions = {}
  ): Promise<Map<string, ResolvedTemplate>> {
    const results = new Map<string, ResolvedTemplate>();
    if (keys.length === 0) return results;

    const rawKeys = keys.map((k) => k.key);
    const resolved = await resolveWikiPlaceholderValues(
      rawKeys,
      prisma,
      opts.activeCountryId ?? undefined
    );

    for (const item of resolved) {
      results.set(item.key, {
        key: item.key,
        value: item.value,
      });
    }

    return results;
  },
};
