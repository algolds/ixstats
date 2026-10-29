import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

// Must match the backend username rule
const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * Live availability of a candidate ThinkPages username. `countryId` is the persona's nation, so a
 * name held by an unclaimed IxTwitter import for that nation reads as available (claimable).
 */
/** The settled answer for the current input; undefined while a check runs (keep the previous one). */
function settledAvailability(
  username: string,
  isValidUsernameFormat: boolean,
  check: { isLoading: boolean; hasError: boolean; isAvailable: boolean | undefined }
): boolean | null | undefined {
  // Too short to check
  if (username.length < 3) return null;
  if (!isValidUsernameFormat) return false;
  if (check.isLoading) return undefined;
  // A network or server error shows the neutral state, not "taken"
  if (check.hasError) return null;
  return check.isAvailable;
}

/**
 * Live availability of a candidate ThinkPages username. `countryId` is the persona's nation, so a
 * name held by an unclaimed IxTwitter import for that nation reads as available (claimable).
 */
export function useUsernameAvailability(username: string, countryId?: string) {
  const [lastAnswer, setLastAnswer] = useState<boolean | null>(null);

  const isValidUsernameFormat =
    username.length >= 3 && username.length <= 20 && USERNAME_PATTERN.test(username);

  const {
    data: availability,
    isLoading,
    error,
  } = api.thinkpages.checkUsernameAvailability.useQuery(
    { username, countryId },
    {
      enabled: isValidUsernameFormat,
      staleTime: 500,
      refetchOnWindowFocus: false,
      retry: false, // Don't retry on validation errors
    }
  );

  const settled = settledAvailability(username, isValidUsernameFormat, {
    isLoading,
    hasError: Boolean(error),
    isAvailable: availability?.isAvailable,
  });
  // Remember the last settled answer so it stays up while the next check runs
  if (settled !== undefined && settled !== lastAnswer) setLastAnswer(settled);
  const isUsernameAvailable = settled === undefined ? lastAnswer : settled;
  const isCheckingUsername = isValidUsernameFormat && isLoading;

  useEffect(() => {
    if (isValidUsernameFormat && !isLoading && error) {
      console.error("[Username Check] Error checking username:", error);
    }
  }, [error, isLoading, isValidUsernameFormat]);

  return {
    isUsernameAvailable,
    isCheckingUsername,
    isValidUsernameFormat,
    /** The name belongs to an unclaimed IxTwitter account that creating the persona will claim. */
    isClaimable: isUsernameAvailable === true && availability?.claimable === true,
    availability,
    isLoading,
    reset: () => setLastAnswer(null),
  };
}
