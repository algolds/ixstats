"use client";

import React, { useEffect, useState } from "react";
import {
  AbilityProvider as CaslAbilityProvider,
  Can as CaslCan,
  useAbility as useCaslAbility,
} from "@casl/react";
import { api } from "~/trpc/react";
import { type AppAbility, defineAbilityFor } from "~/lib/auth";
import { useUser } from "@clerk/nextjs";

// Re-export Can and useAbility with proper typings for our app
export const Can = CaslCan;
export function useAbility(): AppAbility {
  return useCaslAbility<AppAbility>();
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

  const [ability, setAbility] = useState<AppAbility>(() =>
    defineAbilityFor("guest", [], "basic", [])
  );

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

  return <CaslAbilityProvider value={ability}>{children}</CaslAbilityProvider>;
}
