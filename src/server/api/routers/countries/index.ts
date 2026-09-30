import { createTRPCRouter } from "~/server/api/trpc";
import { listProcedures } from "./list";
import { economyProcedures } from "./economy";
import { identityProcedures } from "./identity";
import { managementProcedures } from "./management";
import { wikiProcedures } from "./wiki";
import { atomicProcedures } from "./atomic";
import { flagsProcedures } from "./flags";

export const countriesRouter = createTRPCRouter({
  ...listProcedures,
  ...economyProcedures,
  ...identityProcedures,
  ...managementProcedures,
  ...wikiProcedures,
  ...atomicProcedures,
  flags: flagsProcedures,
});
