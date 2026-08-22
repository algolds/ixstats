"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { type Actions, type AppAbility, type Subjects, defineAbilityFor } from "~/lib/auth";
import { useUser } from "@clerk/nextjs";

const defaultAbility = defineAbilityFor("guest", [], "basic", []);
const AbilityContext = createContext<AppAbility>(defaultAbility);

export function useAbility(): AppAbility {
  return useContext(AbilityContext);
}

export interface CanProps {
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

  const [ability, setAbility] = useState<AppAbility>(defaultAbility);

  // Re-build abilities when data changes
  useEffect(() => {
    if (user && data) {
      setAbility(
        defineAbilityFor(data.role, data.permissions, data.membershipTier, data.unlockedTools)
      );
    } else if (isLoaded && !user) {
      // Clear/Reset to guest abilities on logout
      setAbility(defineAbilityFor("guest", [], "basic", []));
    }
  }, [data, user, isLoaded]);

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
