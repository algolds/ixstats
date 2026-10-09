"use client";

import Link from "next/link";
import { ShieldCheck } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useUser } from "~/context/auth-context";
import { categoryHref, modHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { CategoryRows } from "./CategoryRows";
import { RealmSection } from "./RealmSection";
import { StandingCard } from "./StandingCard";

/**
 * Forum home: the sitewide categories the viewer can see (ruling P1), then a realm's section with the switcher.
 * Signed in, also the member's standing when they have one, and "Moderation" for anyone who moderates something.
 */
export function CategoryList({ realm }: { realm?: string }) {
  const { isSignedIn } = useUser();
  const signedIn = isSignedIn === true;
  const { data: categories, isLoading } = api.thinkpagesForum.categories.useQuery();
  const { data: moderates } = api.thinkpagesForumMod.context.useQuery(undefined, {
    enabled: signedIn,
  });
  const moderator =
    signedIn &&
    !!moderates &&
    (moderates.isSiteAdmin || moderates.realms.length > 0 || moderates.categories.length > 0);

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-4 sm:py-6 md:py-8">
      <PageHeader
        title="ThinkPages Forum"
        bleed
        actions={
          moderator ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={modHref()}>
                <ShieldCheck aria-hidden />
                Moderation
              </Link>
            </Button>
          ) : null
        }
      />
      {signedIn ? <StandingCard /> : null}
      {isLoading ? (
        <Skeleton className="rounded-card h-64 w-full" />
      ) : (
        <Card content="navigation" className="overflow-hidden">
          {categories && categories.length > 0 ? (
            <CategoryRows categories={categories} hrefOf={categoryHref} />
          ) : (
            <EmptyState compact title="No categories yet" />
          )}
        </Card>
      )}
      <RealmSection realm={realm} switcher />
    </div>
  );
}
