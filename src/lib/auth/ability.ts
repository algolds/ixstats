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
  const isPremium = normalizedTier === "mycountry_premium" || isOwner || isAdmin || isStaff;

  const canManageUser =
    isOwner || isAdmin || permissions.some((p) => p.startsWith("user."));
  const canManageRole =
    isOwner || isAdmin || permissions.some((p) => p.startsWith("role."));
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

    if (subject === "all") {
      return isOwner;
    }

    if (subject === "User") {
      if (
        action === "manage" ||
        action === "read" ||
        action === "update" ||
        action === "create" ||
        action === "delete"
      ) {
        return canManageUser;
      }
    }

    if (subject === "Role") {
      if (
        action === "manage" ||
        action === "read" ||
        action === "update" ||
        action === "create" ||
        action === "delete"
      ) {
        return canManageRole;
      }
    }

    if (subject === "SystemConfig") {
      if (action === "manage" || action === "update" || action === "create" || action === "delete") {
        return canManageSystemConfig;
      }
      if (action === "read") {
        return canReadSystemConfig;
      }
    }

    if (subject === "MyCountryFeature") {
      const section = typeof fieldOrExtra === "string" ? fieldOrExtra : "";
      if (["overview", "executive", "politics", "economy", "diplomacy"].includes(section)) {
        return true;
      }
      if (["defense", "intelligence", "map-editor"].includes(section)) {
        return isPremium;
      }
      return true;
    }

    if (subject === "Tool") {
      if (typeof fieldOrExtra === "object" && fieldOrExtra !== null && "toolId" in fieldOrExtra) {
        return unlockedToolSet.has(fieldOrExtra.toolId);
      }
      if (typeof fieldOrExtra === "string") {
        return unlockedToolSet.has(fieldOrExtra);
      }
      return true;
    }

    return false;
  };

  return {
    can,
    cannot: (action, subject, fieldOrExtra) => !can(action, subject, fieldOrExtra),
  };
}
