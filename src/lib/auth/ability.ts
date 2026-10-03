import { hasPremiumTier } from "./premium";

export type Actions = "manage" | "create" | "read" | "update" | "delete" | "use" | "access";

export type Subjects =
  | "all"
  | "User"
  | "Role"
  | "SystemConfig"
  | "MyCountryFeature"
  | "Tool"
  | { type: "Tool"; toolId: string; unlocked?: boolean }
  | Record<string, any>;

const CRUD_ACTIONS: Actions[] = ["manage", "read", "update", "create", "delete"];
const PREMIUM_SECTIONS = ["defense", "intelligence", "map-editor"];

/** A tool id given directly or as `{ toolId }`. */
const toolIdOf = (value: unknown): string | undefined =>
  typeof value === "string"
    ? value
    : value && typeof value === "object" && "toolId" in value
      ? (value as { toolId: string }).toolId
      : undefined;

export interface AppAbility {
  can(action: Actions, subject: Subjects, fieldOrExtra?: any): boolean;
  cannot(action: Actions, subject: Subjects, fieldOrExtra?: any): boolean;
}

/**
 * Native, zero-dependency role and capability checker replacing CASL.
 */
export function defineAbilityFor(
  roleName: string | null | undefined,
  permissions: string[] = [],
  membershipTier: string | null | undefined,
  unlockedTools: string[] = []
): AppAbility {
  const normalizedRole = roleName || "user";
  const normalizedTier = membershipTier || "basic";
  const isOwner = normalizedRole === "owner";
  const isAdmin = normalizedRole === "admin";
  const isStaff = normalizedRole === "staff";
  const isPremium = hasPremiumTier(normalizedTier) || isOwner || isAdmin || isStaff;

  const canManageUser = isOwner || isAdmin || permissions.some((p) => p.startsWith("user."));
  const canManageRole = isOwner || isAdmin || permissions.some((p) => p.startsWith("role."));
  const canManageSystemConfig = isOwner || permissions.includes("system.config");
  const canReadSystemConfig =
    isOwner || isAdmin || canManageSystemConfig || permissions.includes("system.logs");

  const unlockedToolSet = new Set(["basic_calculator", ...unlockedTools]);

  const can = (action: Actions, subject: Subjects, fieldOrExtra?: any): boolean => {
    if (isOwner) return true;

    // Check object subject (e.g. { type: "Tool", toolId: "...", unlocked: true })
    if (typeof subject === "object" && subject !== null) {
      if ("type" in subject && subject.type === "Tool") {
        if (action === "use" || action === "manage") {
          return unlockedToolSet.has((subject as any).toolId);
        }
      }
      return false;
    }

    if (subject === "User" && CRUD_ACTIONS.includes(action)) return canManageUser;
    if (subject === "Role" && CRUD_ACTIONS.includes(action)) return canManageRole;
    if (subject === "SystemConfig") {
      if (action === "read") return canReadSystemConfig;
      if (CRUD_ACTIONS.includes(action)) return canManageSystemConfig;
    }

    if (subject === "MyCountryFeature") {
      const section = typeof fieldOrExtra === "string" ? fieldOrExtra : "";
      return !PREMIUM_SECTIONS.includes(section) || isPremium;
    }

    if (subject === "Tool") {
      const toolId = toolIdOf(fieldOrExtra);
      return toolId === undefined || unlockedToolSet.has(toolId);
    }

    return false;
  };

  return {
    can,
    cannot: (action, subject, fieldOrExtra) => !can(action, subject, fieldOrExtra),
  };
}
