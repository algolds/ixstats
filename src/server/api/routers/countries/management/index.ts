import { managementLifecycleProcedures } from "./lifecycle";
import { managementCreateProcedures } from "./create";

export const managementProcedures = {
  ...managementLifecycleProcedures,
  ...managementCreateProcedures,
};
