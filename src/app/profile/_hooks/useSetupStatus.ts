import type { UserResource } from "@clerk/types";

type SetupStatus = 'loading' | 'unauthenticated' | 'needs-setup' | 'complete';

interface UseSetupStatusProps {
  isLoaded: boolean;
  profileLoading: boolean | undefined;
  user: UserResource | null | undefined;
  userProfile: any;
}

export function useSetupStatus({ isLoaded, profileLoading, user, userProfile }: UseSetupStatusProps): SetupStatus {
  if (!isLoaded || profileLoading) return 'loading';
  if (!user) return 'unauthenticated';
  if (!userProfile?.countryId) return 'needs-setup';
  return 'complete';
}
