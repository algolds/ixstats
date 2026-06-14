import { managementAdminProcedures } from "./admin";
import { managementLifecycleProcedures } from "./lifecycle";
import { managementCreateProcedures } from "./create";
import { managementUpdateProcedures } from "./update";
import { managementStorytellerProcedures } from "./storyteller";

export const managementProcedures = {
  ...managementAdminProcedures,
  ...managementLifecycleProcedures,
  ...managementCreateProcedures,
  ...managementUpdateProcedures,
  ...managementStorytellerProcedures,
};
