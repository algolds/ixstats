"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { MYCOUNTRY_WELCOME_PATH } from "~/lib/mycountry/routes";
import { AuthenticationGuard } from "~/components/mycountry/shared/primitives";
import { api } from "~/trpc/react";
import { WELCOME_COLUMN, WelcomeSkeleton, WelcomeView } from "./WelcomeView";

/** Where a player without a nation goes instead: founding one. */
export const NO_NATION_REDIRECT = "/builder";

function Welcome() {
  const router = useRouter();
  const { user } = useUser();
  const welcome = api.mycountry.getWelcome.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });
  const nation = welcome.data;
  const noNation = welcome.isSuccess && nation == null;

  usePageTitle({ title: nation ? `${nation.name} is founded` : "Welcome" });

  useEffect(() => {
    if (noNation) router.replace(NO_NATION_REDIRECT);
  }, [noNation, router]);

  if (welcome.isError) {
    return (
      <div className={`${WELCOME_COLUMN} pt-(--shell-top-offset)`}>
        <h1 className="sr-only">Welcome</h1>
        <EmptyState
          title="Couldn't load your nation."
          message="Check your connection and try again."
          action={
            <Button variant="secondary" onClick={() => void welcome.refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (!nation) return <WelcomeSkeleton />;
  return <WelcomeView nation={nation} />;
}

/** The full-page welcome right after founding a nation. */
export function WelcomeScreen() {
  return (
    <AuthenticationGuard redirectPath={MYCOUNTRY_WELCOME_PATH}>
      <Welcome />
    </AuthenticationGuard>
  );
}
