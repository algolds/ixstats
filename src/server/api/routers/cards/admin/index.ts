/**
 * The card admin (cards refresh spec §2.4): one sub-router per `/admin/cards` tab, plus NationStates imports and
 * the player tools, mounted at `api.cards.admin.<tab>.*`. Every procedure is `adminProcedure`
 * (src/tests/architecture/cards-admin-gate.test.ts); routers validate and call `src/server/modules/cards/*`.
 */
import { createTRPCRouter } from "~/server/api/trpc";
import { cardsAdminOverviewRouter } from "./overview";
import { cardsAdminLibraryRouter } from "./library";
import { cardsAdminImportsRouter } from "./imports";
import { cardsAdminNationStatesRouter } from "./nationstates";
import { cardsAdminCurationRouter } from "./curation";
import { cardsAdminPacksRouter } from "./packs";
import { cardsAdminEconomyRouter } from "./economy";
import { cardsAdminSeasonsRouter } from "./seasons";
import { cardsAdminComplianceRouter } from "./compliance";
import { cardsAdminDesignerRouter } from "./designer";
import { cardsAdminToolsRouter } from "./tools";

export const cardsAdminRouter = createTRPCRouter({
  overview: cardsAdminOverviewRouter,
  library: cardsAdminLibraryRouter,
  imports: cardsAdminImportsRouter,
  nationstates: cardsAdminNationStatesRouter,
  curation: cardsAdminCurationRouter,
  packs: cardsAdminPacksRouter,
  economy: cardsAdminEconomyRouter,
  seasons: cardsAdminSeasonsRouter,
  compliance: cardsAdminComplianceRouter,
  designer: cardsAdminDesignerRouter,
  tools: cardsAdminToolsRouter,
});
