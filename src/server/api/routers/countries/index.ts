import { createTRPCRouter } from "~/server/api/trpc";
import { listProcedures } from "./list";
import { economyProcedures } from "./economy";
import { identityProcedures } from "./identity";
import { managementProcedures } from "./management";
import { diplomacyProcedures } from "./diplomacy";
import { wikiProcedures } from "./wiki";
import { atomicProcedures } from "./atomic";
import { geographyProcedures } from "./geography";

export const countriesRouter = createTRPCRouter({
  ...listProcedures,
  ...economyProcedures,
  ...identityProcedures,
  ...managementProcedures,
  ...diplomacyProcedures,
  ...wikiProcedures,
  ...atomicProcedures,
  ...geographyProcedures,
});

