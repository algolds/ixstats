export type InterfaceType = "sdi" | "eci" | "redirect";

export interface UserProfile {
  id: string;
  role: "admin" | "dm" | "observer" | "user";
  countryId?: string;
  preferences?: {
    globalView?: boolean;
  };
}

export function determineUserInterface(user: UserProfile): InterfaceType {
  // Admin users get access to both (default to SDI)
  if (user.role === "admin" || user.role === "dm") {
    return "sdi";
  }

  // Users with linked countries get ECI
  if (user.countryId) {
    return "eci";
  }

  // Observers and global users get SDI
  if (user.role === "observer" || user.preferences?.globalView) {
    return "sdi";
  }

  // Default to setup/redirect
  return "redirect";
}

export function getUserInterfacePreferences(user: UserProfile) {
  return {
    canAccessSDI: user.role === "admin" || user.role === "dm" || user.role === "observer",
    canAccessECI: !!user.countryId,
    defaultInterface: determineUserInterface(user),
    hasSecureComms: user.role === "admin" || user.role === "dm" || !!user.countryId,
  };
}

export function hasInterfaceAccess(
  userRole: string,
  userCountryId: string | undefined,
  interfaceType: "sdi" | "eci"
): boolean {
  if (interfaceType === "sdi") {
    return userRole === "admin" || userRole === "dm" || userRole === "observer";
  }

  if (interfaceType === "eci") {
    return !!userCountryId;
  }

  return false;
}
