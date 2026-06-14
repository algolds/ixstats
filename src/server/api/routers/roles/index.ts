/**
 * Roles router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.roles.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - lookup:       read-only role and permission listings
 *  - management:   role CRUD (create/update/delete) plus role-system bootstrap
 *  - assignments:  user↔role relations (assign/remove/list users with roles, audit logs)
 */
import { mergeRouters } from "~/server/api/trpc";
import { rolesLookupRouter } from "./lookup";
import { rolesManagementRouter } from "./management";
import { rolesAssignmentsRouter } from "./assignments";

export const rolesRouter = mergeRouters(
  rolesLookupRouter,
  rolesManagementRouter,
  rolesAssignmentsRouter
);
