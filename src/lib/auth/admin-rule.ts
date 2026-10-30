/**
 * The one admin rule. The proxy (/admin), the admin layout, the shell nav, Halo and tRPC's adminProcedure all ask
 * this, so a user who sees the way into /admin is never bounced from it. The system owner is let in before this
 * is asked, by each caller.
 */

const ADMIN_ROLE_NAMES: ReadonlySet<string> = new Set(["owner", "admin", "staff"]);

/** Staff level: a role at this level or less (more privileged) is an admin role, whatever its name. */
const ADMIN_MAX_LEVEL = 20;

interface AdminRuleRole {
  name: string | null;
  level: number | null;
}

/** Whether a database role opens /admin: an owner, admin or staff name, or a level of 20 or less (staff and above). */
export function isAdminRole(role: AdminRuleRole | null | undefined): boolean {
  if (!role) return false;
  if (role.name !== null && ADMIN_ROLE_NAMES.has(role.name)) return true;
  return role.level !== null && role.level <= ADMIN_MAX_LEVEL;
}
