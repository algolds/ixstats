"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useHydrated } from "~/hooks/useHydrated";
import { api } from "~/trpc/react";
import { type Actions, type AppAbility, type Subjects, defineAbilityFor } from "~/lib/auth";
import { useUser } from "@clerk/nextjs";

const defaultAbility = defineAbilityFor("guest", [], "basic", []);
const AbilityContext = createContext<AppAbility>(defaultAbility);

export function useAbility(): AppAbility {
  return useContext(AbilityContext);
}

interface CanProps {
  I: Actions;
  a: Subjects;
  field?: any;
  passThrough?: boolean;
  children: React.ReactNode | ((allowed: boolean) => React.ReactNode);
}

export function Can({ I, a, field, passThrough, children }: CanProps) {
  const ability = useAbility();
  const allowed = ability.can(I, a, field);

  if (typeof children === "function") {
    return <>{children(allowed)}</>;
  }

  if (allowed || passThrough) {
    return <>{children}</>;
  }

  return null;
}

interface AbilityProviderProps {
  children: React.ReactNode;
}

export function AbilityProvider({ children }: AbilityProviderProps) {
  const { user, isLoaded } = useUser();

  // Fetch current user abilities via tRPC
  const { data, refetch } = api.users.getCurrentUserAbilities.useQuery(undefined, {
    enabled: isLoaded && !!user,
    refetchOnWindowFocus: false,
  });

  // Guest abilities on the server and while hydrating (so server HTML always matches), and for
  // signed-out visitors or until the signed-in user's abilities load; theirs after that
  const hydrated = useHydrated();
  const ability =
    hydrated && user && data
      ? defineAbilityFor(data.role, data.permissions, data.membershipTier, data.unlockedTools)
      : defaultAbility;

  // Listen for custom event to refetch permissions when they are updated in the admin panel
  useEffect(() => {
    const handlePermissionsUpdate = () => {
      void refetch();
    };

    window.addEventListener("ixstates:permissions-updated", handlePermissionsUpdate);
    return () => {
      window.removeEventListener("ixstates:permissions-updated", handlePermissionsUpdate);
    };
  }, [refetch]);

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}
