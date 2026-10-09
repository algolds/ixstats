"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { categoryHref, forumHomeHref, threadHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { BanNotice } from "./BanNotice";
import { ForumComposer, type ForumComposerInput } from "./ForumComposer";
import { ForumLoadError } from "./ForumPageState";

interface NewThreadFormProps {
  categoryKey: string;
  /** The realm's slug for a realm category; absent for the sitewide section. */
  realm?: string;
}

/** Start a thread in a category; on success the new thread opens. */
export function NewThreadForm({ categoryKey, realm }: NewThreadFormProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data, isLoading, error, refetch } = api.thinkpagesForum.category.useQuery({
    key: categoryKey,
    page: 1,
    realm,
  });
  const { mutateAsync: createThread } = api.thinkpagesForum.createThread.useMutation();
  const backHref = categoryHref({ key: categoryKey, realm: realm ? { slug: realm } : null });

  const submit = useCallback(
    async ({ html, personaId, title }: ForumComposerInput) => {
      const { threadId } = await createThread({
        categoryKey,
        realm,
        title: title ?? "",
        html,
        personaId,
      });
      void utils.thinkpagesForum.category.invalidate({ key: categoryKey });
      void utils.thinkpagesForum.categories.invalidate();
      void utils.thinkpagesForum.realmSection.invalidate();
      router.push(threadHref(threadId));
    },
    [createThread, categoryKey, realm, utils, router]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="rounded-card h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <ForumLoadError
        notFound={error?.data?.code === "NOT_FOUND"}
        notFoundTitle="Category not found"
        notFoundMessage="It may be private, or the link is incorrect."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data.canStart) {
    const back = (
      <Button asChild variant="secondary">
        <Link href={forumHomeHref(realm)}>Back to the forum</Link>
      </Button>
    );
    return (
      <div className="container mx-auto max-w-3xl space-y-4 px-4 py-8">
        {data.banned && data.notice ? (
          <>
            <BanNotice notice={data.notice} />
            {back}
          </>
        ) : (
          <Card>
            <EmptyState
              title="You can't start a thread here"
              message={data.notice ?? "Sign in, or pick a category open to members."}
              action={back}
            />
          </Card>
        )}
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
