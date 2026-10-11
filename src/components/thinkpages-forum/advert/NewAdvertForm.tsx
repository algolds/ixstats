"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Lock } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { useUser } from "~/context/auth-context";
import { ADVERT_CATEGORY_KEY, ADVERT_HIDDEN_NOTICE } from "~/lib/thinkpages-forum/adverts";
import { categoryHref, newAdvertHref, threadHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { CanvasComposer, type CanvasSubmitMeta } from "../composer";
import { ForumFormPage, OpenStartedLink } from "../ForumFormPage";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import { advertThreadIdOf } from "./advert-error";

const BACK = { href: categoryHref({ key: ADVERT_CATEGORY_KEY }), label: "Find a Realm" };

interface RealmChoice {
  slug: string;
  name: string;
  advertThreadId: string | null;
  hiddenByModerator: boolean;
}

function BackToBoard() {
  return (
    <Button asChild variant="secondary" className="pointer-coarse:min-h-11">
      <Link href={BACK.href}>Back to Find a Realm</Link>
    </Button>
  );
}

function Refusal({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <EmptyState icon={<Lock />} title={title} message={message} action={<BackToBoard />} />
    </Card>
  );
}

function ExistingAdvert({ name, threadId }: { name: string; threadId: string }) {
  return (
    <Card>
      <EmptyState
        title={`${name} already has an advert`}
        message="A realm has one advert. Edit it instead."
        action={
          <Button asChild className="pointer-coarse:min-h-11">
            <Link href={threadHref(threadId)}>Edit your advert</Link>
          </Button>
        }
      />
    </Card>
  );
}

const ROW =
  "hover:bg-fill-4 text-callout flex items-center justify-between gap-3 px-4 py-3 pointer-coarse:min-h-11";

function RealmPicker({ choices, named }: { choices: RealmChoice[]; named: boolean }) {
  return (
    <Card content="navigation">
      <EmptyState
        compact
        title="Choose a realm"
        message={
          named
            ? "You can't advertise that realm. Choose one of yours."
            : "You can advertise more than one realm."
        }
      />
      <ul className="divide-separator divide-y">
        {choices.map((c) => (
          <li key={c.slug}>
            {c.hiddenByModerator ? (
              <p className={`${ROW} text-label-secondary`}>
                <span>{c.name}</span>
                <span>Advert hidden by a moderator</span>
              </p>
            ) : (
              <Link
                href={c.advertThreadId ? threadHref(c.advertThreadId) : newAdvertHref(c.slug)}
                className={ROW}
              >
                <span>{c.name}</span>
                <span className="text-label-secondary">
                  {c.advertThreadId ? `Edit the ${c.name} advert` : `Advertise ${c.name}`}
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * The realm's advert form: a Canvas post that `createAdvert` starts in Find a Realm. The server's CONFLICT for a
 * realm another tab advertised first names the existing thread (`racedId`), which the form then shows instead.
 */
function AdvertComposer({
  realm,
  onRaced,
}: {
  realm: RealmChoice;
  onRaced: (threadId: string) => void;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const { mutateAsync: createAdvert } = api.thinkpagesForum.createAdvert.useMutation();
  // A thread whose first post is still being formatted, or that earned a reward the composer shows, opens on request.
  const [startedId, setStartedId] = useState<string | null>(null);
  const submit = useCallback(
    async (wikitext: string, { title }: CanvasSubmitMeta) => {
      try {
        const { threadId, formatting, reward } = await createAdvert({
          realm: realm.slug,
          title,
          wikitext,
        });
        void utils.thinkpagesForum.category.invalidate();
        void utils.thinkpagesForum.categories.invalidate();
        void utils.thinkpagesForum.myAdvertRealms.invalidate();
        if (formatting === "done" && !reward) router.push(threadHref(threadId));
        else setStartedId(threadId);
        return { formatting, reward };
      } catch (cause) {
        const existing = cause instanceof Error ? advertThreadIdOf(cause) : null;
        if (existing) onRaced(existing);
        throw cause;
      }
    },
    [realm.slug, createAdvert, utils, router, onRaced]
  );
  return (
    <>
      <CanvasComposer mode="thread" onSubmit={submit} />
      {startedId ? <OpenStartedLink href={threadHref(startedId)} label="Open the advert" /> : null}
    </>
  );
}

/** What the form shows for the realm the viewer named or has only one of. */
function ChosenRealm({
  realm,
  racedId,
  onRaced,
}: {
  realm: RealmChoice;
  racedId: string | null;
  onRaced: (threadId: string) => void;
}) {
  const existingId = realm.advertThreadId ?? racedId;
  if (realm.hiddenByModerator)
    return <Refusal title={`The ${realm.name} advert is hidden`} message={ADVERT_HIDDEN_NOTICE} />;
  if (existingId) return <ExistingAdvert name={realm.name} threadId={existingId} />;
  return <AdvertComposer realm={realm} onRaced={onRaced} />;
}

/**
 * The form that creates a realm's advert in Find a Realm. The realm is fixed: the `advert` query parameter, or the
 * viewer's only realm; with several and none named, a picker. A realm that already has an advert shows it instead of
 * a composer. The server validates everything.
 */
export function NewAdvertForm({ realm }: { realm?: string }) {
  const { isSignedIn } = useUser();
  const { data, isLoading, error, refetch } = api.thinkpagesForum.myAdvertRealms.useQuery(
    undefined,
    { enabled: !!isSignedIn }
  );
  const [racedId, setRacedId] = useState<string | null>(null);
  const choices = data?.realms ?? [];
  const chosen =
    choices.find((c) => c.slug === realm) ??
    (realm === undefined && choices.length === 1 ? choices[0] : undefined);
  const page = (children: ReactNode, breadcrumbs?: string) => (
    <ForumFormPage title="Advertise your realm" breadcrumbs={breadcrumbs} back={BACK}>
      {children}
    </ForumFormPage>
  );

  if (!isSignedIn) {
    return page(
      <Refusal
        title="Sign in to advertise your realm"
        message="Only a realm's founder and officers can post its advert."
      />
    );
  }
  if (isLoading) return <ForumPageSkeleton />;
  if (!data) {
    return (
      <ForumLoadError
        notFound={error?.data?.code === "NOT_FOUND"}
        notFoundTitle="Realms not found"
        notFoundMessage="Try again in a moment."
        onRetry={() => void refetch()}
      />
    );
  }
  if (choices.length === 0) {
    return page(
      <Refusal
        title="You can't advertise a realm"
        message="Only a realm's founder and officers with the Appearance power can post its advert."
      />
    );
  }
  if (!chosen) return page(<RealmPicker choices={choices} named={realm !== undefined} />);
  return page(<ChosenRealm realm={chosen} racedId={racedId} onRaced={setRacedId} />, chosen.name);
}
