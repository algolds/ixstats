"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { ForumComposer, type ForumComposerInput } from "./ForumComposer";

/** Start a thread in a category; on success the new thread opens. */
export function NewThreadForm({ categoryKey }: { categoryKey: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data, isLoading } = api.thinkpagesForum.category.useQuery({ key: categoryKey, page: 1 });
  const { mutateAsync: createThread } = api.thinkpagesForum.createThread.useMutation();
  const backHref = `/thinkpages/c/${categoryKey}`;

  const submit = useCallback(
    async ({ html, personaId, title }: ForumComposerInput) => {
      const { threadId } = await createThread({
        categoryKey,
        title: title ?? "",
        html,
        personaId,
      });
      void utils.thinkpagesForum.category.invalidate({ key: categoryKey });
      void utils.thinkpagesForum.categories.invalidate();
      router.push(`/thinkpages/t/${threadId}`);
    },
    [createThread, categoryKey, utils, router]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="rounded-card h-48 w-full" />
      </div>
    );
  }

  if (!data?.canStart) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <EmptyState
            title="You can't start a thread here"
            message="Sign in, or pick a category open to members."
            action={
              <Button asChild variant="secondary">
                <Link href="/thinkpages/forum">Back to the forum</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-4 sm:py-6 md:py-8">
      <PageHeader
        title="New thread"
        subtitle={data.category.name}
        back={{ href: backHref, label: data.category.name }}
        bleed
      />
      <ForumComposer icAllowed={data.category.icAllowed} titleField onSubmit={submit} />
    </div>
  );
}
