import { managementLifecycleProcedures } from "./lifecycle";
import { managementCreateProcedures } from "./create";
import { managementUpdateProcedures } from "./update";

export const managementProcedures = {
  ...managementLifecycleProcedures,
  ...managementCreateProcedures,
  ...managementUpdateProcedures,
};
