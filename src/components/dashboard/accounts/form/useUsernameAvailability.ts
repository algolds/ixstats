import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

// Must match the backend username rule
const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/** Live availability of a candidate ThinkPages username. */
export function useUsernameAvailability(username: string) {
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const isValidUsernameFormat =
    username.length >= 3 && username.length <= 20 && USERNAME_PATTERN.test(username);

  const {
    data: availability,
    isLoading,
    error,
  } = api.thinkpages.checkUsernameAvailability.useQuery(
    { username },
    {
      enabled: isValidUsernameFormat,
      staleTime: 500,
      refetchOnWindowFocus: false,
      retry: false, // Don't retry on validation errors
    }
  );

  useEffect(() => {
    if (username.length < 3) {
      // Too short to check
      // oxlint-disable-next-line
      setIsUsernameAvailable(null);
      setIsCheckingUsername(false);
    } else if (!isValidUsernameFormat) {
      setIsUsernameAvailable(false);
      setIsCheckingUsername(false);
    } else if (isLoading) {
      // Keep the previous answer while the check runs
      setIsCheckingUsername(true);
    } else if (error) {
      // A network or server error shows the neutral state, not "taken"
      setIsUsernameAvailable(null);
      setIsCheckingUsername(false);
      console.error("[Username Check] Error checking username:", error);
    } else if (availability !== undefined) {
      setIsUsernameAvailable(availability.isAvailable);
      setIsCheckingUsername(false);
    }
  }, [availability, isLoading, error, username, isValidUsernameFormat]);

  return {
    isUsernameAvailable,
    isCheckingUsername,
    isValidUsernameFormat,
    availability,
    isLoading,
    reset: () => setIsUsernameAvailable(null),
  };
}
