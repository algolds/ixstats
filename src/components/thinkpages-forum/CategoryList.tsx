"use client";

import { PageHeader } from "~/components/shell/PageHeader";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { categoryHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { CategoryRows } from "./CategoryRows";
import { RealmSection } from "./RealmSection";

/** Forum home: the sitewide categories the viewer can see (ruling P1), then a realm's section with the switcher. */
export function CategoryList({ realm }: { realm?: string }) {
  const { data: categories, isLoading } = api.thinkpagesForum.categories.useQuery();

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-4 sm:py-6 md:py-8">
      <PageHeader title="ThinkPages Forum" bleed />
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
