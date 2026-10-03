// Every router is a static ESM import, so a broken router fails the module load
// (and the server boot) loudly — there is no runtime wrapper to hide that.

import { createCallerFactory, createTRPCRouter, mergeRouters } from "~/server/api/trpc";
import { countriesRouter } from "./routers/countries";
import { adminRouter } from "./routers/admin";
import { usersRouter } from "./routers/users";
import { systemRouter } from "./routers/system";
import { cacheRouter } from "./routers/cache";
import { notificationsRouter } from "./routers/notifications";
import { activitiesRouter } from "./routers/activities";
import { achievementsRouter } from "./routers/achievements";
import { userLoggingRouter } from "./routers/user-logging";
import { demoModeRouter } from "./routers/demo-mode";
import { systemValidationRouter } from "./routers/system-validation";
import { autosaveHistoryRouter } from "./routers/autosaveHistory";
import { autosaveMonitoringRouter } from "./routers/autosaveMonitoring";
import { builderDraftRouter } from "./routers/builderDraft";
import { onomaRouter } from "./routers/onoma";
import { intentRouter } from "./routers/intent";
import { economicsRouter } from "./routers/economics";
import { economicComponentsRouter } from "./routers/economicComponents";
import { economicArchetypesRouter } from "./routers/economicArchetypes";
import { formulasRouter } from "./routers/formulas";
import { taxSystemRouter } from "./routers/taxSystem";
import { governmentRouter } from "./routers/government";
import { atomicGovernmentRouter } from "./routers/atomicGovernment";
import { governmentComponentsRouter } from "./routers/governmentComponents";
import { policiesRouter } from "./routers/policies";
import { legislationRouter } from "./routers/legislation";
import { electionsRouter } from "./routers/elections";
import { customTypesRouter } from "./routers/customTypes";
import { quickActionsRouter } from "./routers/quickactions";
import { scheduledChangesRouter } from "./routers/scheduledChanges";
import { nationalIssuesRouter } from "./routers/national-issues";
import { diplomaticCoreRouter } from "./routers/diplomacy/core";
import { diplomaticEmbassiesRouter } from "./routers/diplomacy/embassies";
import { diplomaticCulturalRouter } from "./routers/diplomacy/cultural";
import { diplomaticPoliciesRouter } from "./routers/diplomacy/policies";
import { diplomaticScenariosRouter } from "./routers/diplomaticScenarios";
import { npcPersonalitiesRouter } from "./routers/npcPersonalities";
import { crisisEventsRouter } from "./routers/crisis-events";
import { intelligenceRouter } from "./routers/intelligence";
import { securityRouter } from "./routers/security";
import { meetingsRouter } from "./routers/meetings";
import { militaryEquipmentRouter } from "./routers/militaryEquipment";
import { smallArmsEquipmentRouter } from "./routers/smallArmsEquipment";
import { cardsRouter } from "./routers/cards";
import { cardPacksRouter } from "./routers/card-packs";
import { cardMarketRouter } from "./routers/card-market";
import { cardImagesRouter } from "./routers/cardImages";
import { loreCardsRouter } from "./routers/lore-cards";
import { nsImportRouter } from "./routers/ns-import";
import { vaultRouter } from "./routers/vault";
import { craftingRouter } from "./routers/crafting";
import { tradingRouter } from "./routers/trading";
import { geoCoreRouter } from "./routers/geo/core";
import { geoFeaturesRouter } from "./routers/geo/features";
import { geoEditorRouter } from "./routers/geo/editor";
import { geoAdminRouter } from "./routers/geo/admin";
import { geoAdminCitiesRouter } from "./routers/geo/admin/cities";
import { geoSovereigntyRouter } from "./routers/geo/sovereignty";
import { geoWikiRouter } from "./routers/geo/wiki";
import { resourcesRouter } from "./routers/resources";
import { transportRouter } from "./routers/transport";
import { realmsRouter } from "./routers/realms";
import { wikiosRouter } from "./routers/wikios";
import { wikiCacheRouter } from "./routers/wikiCache";
import { lorewardsRouter } from "./routers/lorewards";
import { commonsRouter } from "./routers/commons";
import { heraldryRouter } from "./routers/heraldry";
import { blurbsRouter } from "./routers/blurbs";
import { thinkpagesRouter } from "./routers/thinkpages";
import { messagesRouter } from "./routers/messages";
import { pollsRouter } from "./routers/polls";
import { forumRouter } from "./routers/forum";
import { ixnayidRouter } from "./routers/ixnayid";
import { sportsRouter } from "./routers/sports";
import { narratorRouter } from "./routers/narrator";
import { myCountryRouter } from "./routers/mycountry";
import { historicalRouter } from "./routers/historical";
import { countryGeoRouter } from "./routers/countryGeo";

/** Primary tRPC router. Every router in /api/routers must be registered here. */
export const appRouter = createTRPCRouter({
  countries: countriesRouter,
  admin: adminRouter,
  users: usersRouter,
  system: systemRouter,
  cache: cacheRouter,
  notifications: notificationsRouter,
  activities: activitiesRouter,
  achievements: achievementsRouter,
  userLogging: userLoggingRouter,
  demoMode: demoModeRouter,
  systemValidation: systemValidationRouter,
  autosaveHistory: autosaveHistoryRouter,
  autosaveMonitoring: autosaveMonitoringRouter,
  builderDraft: builderDraftRouter,
  economics: economicsRouter,
  economicComponents: economicComponentsRouter,
  economicArchetypes: economicArchetypesRouter,
  formulas: formulasRouter,
  taxSystem: taxSystemRouter,
  government: governmentRouter,
  atomicGovernment: atomicGovernmentRouter,
  governmentComponents: governmentComponentsRouter,
  policies: policiesRouter,
  legislation: legislationRouter,
  elections: electionsRouter,
  customTypes: customTypesRouter,
  quickActions: quickActionsRouter,
  scheduledChanges: scheduledChangesRouter,
  nationalIssues: nationalIssuesRouter,
  intent: intentRouter,
  diplomaticCore: diplomaticCoreRouter,
  diplomaticEmbassies: diplomaticEmbassiesRouter,
  diplomaticCultural: diplomaticCulturalRouter,
  diplomaticPolicies: diplomaticPoliciesRouter,
  diplomaticScenarios: diplomaticScenariosRouter,
  npcPersonalities: npcPersonalitiesRouter,
  crisisEvents: crisisEventsRouter,
  intelligence: intelligenceRouter,
  security: securityRouter,
  meetings: meetingsRouter,
  militaryEquipment: militaryEquipmentRouter,
  smallArmsEquipment: smallArmsEquipmentRouter,
  cards: cardsRouter,
  cardPacks: cardPacksRouter,
  cardMarket: cardMarketRouter,
  cardImages: cardImagesRouter,
  loreCards: loreCardsRouter,
  nsImport: nsImportRouter,
  vault: vaultRouter,
  crafting: craftingRouter,
  trading: tradingRouter,
  geoCore: geoCoreRouter,
  geoFeatures: geoFeaturesRouter,
  geoEditor: geoEditorRouter,
  geoAdmin: mergeRouters(geoAdminRouter, geoAdminCitiesRouter),
  geoSovereignty: geoSovereigntyRouter,
  geoWiki: geoWikiRouter,
  resources: resourcesRouter,
  transport: transportRouter,
  realms: realmsRouter,
  wikios: wikiosRouter,
  wikiCache: wikiCacheRouter,
  lorewards: lorewardsRouter,
  commons: commonsRouter,
  heraldry: heraldryRouter,
  blurbs: blurbsRouter,
  thinkpages: thinkpagesRouter,
  messages: messagesRouter,
  polls: pollsRouter,
  forum: forumRouter,
  ixnayid: ixnayidRouter,
  sports: sportsRouter,
  narrator: narratorRouter,
  mycountry: myCountryRouter,
  historical: historicalRouter,
  countryGeo: countryGeoRouter,
  onoma: onomaRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.countries.getAll();
 *       ^? CountryData[]
 */
export const createCaller = createCallerFactory(appRouter);
