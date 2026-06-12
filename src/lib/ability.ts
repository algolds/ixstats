import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";

export type Actions = "manage" | "create" | "read" | "update" | "delete" | "use" | "access";

export type Subjects =
  | "all"
  | "User"
  | "Role"
  | "SystemConfig"
  | "MyCountryFeature"
  | "Tool"
  | { type: "Tool"; toolId: string; unlocked: boolean };

export type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * Builds the CASL ability instance for a given user session configuration.
 */
export function defineAbilityFor(
  roleName: string | null | undefined,
  permissions: string[],
  membershipTier: string | null | undefined,
  unlockedTools: string[] = []
): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const normalizedRole = roleName || "user";
  const normalizedTier = membershipTier || "basic";

  // 1. System Overrides (Owner role has full access to everything)
  if (normalizedRole === "owner") {
    can("manage", "all");
  } else if (normalizedRole === "admin") {
    can("manage", "User");
    can("manage", "Role");
    can("read", "SystemConfig");
  }

  // 2. Map Database role permissions to CASL
  for (const perm of permissions) {
    if (perm.startsWith("user.")) {
      can("manage", "User");
    }
    if (perm.startsWith("role.")) {
      can("manage", "Role");
    }
    if (perm === "system.config") {
      can("manage", "SystemConfig");
    }
    if (perm === "system.logs") {
      can("read", "SystemConfig");
    }
  }

  // 3. MyCountry basic vs premium access rules
  const isPremium = normalizedTier === "mycountry_premium";

  // Standard features (open to all)
  can("access", "MyCountryFeature", "overview");
  can("access", "MyCountryFeature", "executive");
  can("access", "MyCountryFeature", "politics");
  can("access", "MyCountryFeature", "economy");
  can("access", "MyCountryFeature", "diplomacy");

  // Premium features (open to premium tier, owner, admin, or staff)
  if (isPremium || ["owner", "admin", "staff"].includes(normalizedRole)) {
    can("access", "MyCountryFeature", "defense");
    can("access", "MyCountryFeature", "intelligence");
    can("access", "MyCountryFeature", "map-editor");
  }

  // 4. Dynamic tools access (attribute-based condition)
  can("use", "Tool", { toolId: "basic_calculator", unlocked: true });

  // Map unlocked tools lists to abilities
  for (const toolId of unlockedTools) {
    can("use", "Tool", { toolId, unlocked: true });
  }

  return build({
    detectSubjectType: (item) => {
      if (typeof item === "string") return item as any;
      return item.type;
    },
  });
}
