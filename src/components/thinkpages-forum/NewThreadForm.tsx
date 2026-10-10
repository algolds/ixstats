"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Lock } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { categoryHref, FORUM_HOME, hubHref, threadHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { BanNotice } from "./BanNotice";
import { CanvasComposer, useMyPersonas, type CanvasSubmitMeta } from "./composer";
import { ForumLoadError, ForumPageSkeleton } from "./ForumPageState";
import { ForumPage } from "./shell";

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
  const personas = useMyPersonas(data?.category.icAllowed === true);
  // A thread whose first post is still being formatted opens on request, so the composer can say so first.
  const [startedId, setStartedId] = useState<string | null>(null);
  const backHref = categoryHref({ key: categoryKey, realm: realm ? { slug: realm } : null });

  const submit = useCallback(
    async (wikitext: string, { personaId, title }: CanvasSubmitMeta) => {
      const { threadId, formatting } = await createThread({
        categoryKey,
        realm,
        title,
        wikitext,
        personaId,
      });
      void utils.thinkpagesForum.category.invalidate({ key: categoryKey });
      void utils.thinkpagesForum.categories.invalidate();
      void utils.thinkpagesForum.realmSection.invalidate();
      if (formatting === "done") router.push(threadHref(threadId));
      else setStartedId(threadId);
      return { formatting };
    },
    [createThread, categoryKey, realm, utils, router]
  );

  if (isLoading) return <ForumPageSkeleton />;

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

  const page = (children: ReactNode) => (
    <ForumPage
      title="New thread"
      breadcrumbs={data.category.name}
      back={{ href: backHref, label: data.category.name }}
    >
      <div className="flex max-w-3xl min-w-0 flex-col gap-4">{children}</div>
    </ForumPage>
  );

  if (!data.canStart) {
    const back = (
      <Button asChild variant="secondary">
        <Link href={realm ? hubHref(realm) : FORUM_HOME}>Back to the forum</Link>
      </Button>
    );
    return page(
      data.banned && data.notice ? (
        <>
          <BanNotice notice={data.notice} />
          {back}
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<Lock />}
            title="You can't start a thread here"
            message={data.notice ?? "Sign in, or pick a category open to members."}
            action={back}
          />
        </Card>
      )
    );
  }

  return page(
    <>
      <CanvasComposer
        mode="thread"
        personas={personas}
        postStyle={data.category.style === "ic" ? "ic" : "ooc"}
        onSubmit={submit}
      />
      {startedId ? (
        <Button asChild variant="secondary" className="pointer-coarse:min-h-11">
          <Link href={threadHref(startedId)}>Open the thread</Link>
        </Button>
      ) : null}
    </>
  );
}
