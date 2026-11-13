"use client";

import { useState, type ComponentProps } from "react";
import Link from "next/link";
import {
  ChatBubbleQuestion,
  CheckCircle,
  EditPencil,
  NavArrowRight,
  OpenNewWindow,
  Send,
  SystemRestart as Loader,
} from "iconoir-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
import { Card, CardTitle } from "~/components/ui/card";
import { LensCard } from "~/components/ui/lens-card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { api, type RouterOutputs } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils";
import { timeAgo } from "~/lib/format/compact";
import { assetUrl } from "~/lib/base-path";

type DailyPrompt = NonNullable<RouterOutputs["blurbs"]["getDailyPrompt"]>;
type MyBlurb = NonNullable<RouterOutputs["blurbs"]["getMyResponse"]>;
type BlurbResponse = RouterOutputs["blurbs"]["getResponsesForPrompt"]["responses"][number];
type SheetIntent = "closed" | "write" | "read";
type CardStatus = "signed-out" | "loading" | "open" | "answered";

const MAX_BLURB = 1000;
const TAP = "pointer-coarse:min-h-11";

const blurbCount = (n: number) => `${n} ${n === 1 ? "blurb" : "blurbs"}`;

/**
 * The dashboard's Daily blurb: one worldbuilding question a day, the same for every nation. The card
 * answers "has my nation answered today?"; writing and reading happen in a sheet.
 */
export function DailyBlurbCard() {
  const { isSignedIn } = useUser();
  const [intent, setIntent] = useState<SheetIntent>("closed");
  const { data: prompt, isLoading } = api.blurbs.getDailyPrompt.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const mine = api.blurbs.getMyResponse.useQuery(
    { promptId: prompt?.id ?? "" },
    { enabled: !!prompt && isSignedIn }
  );

  if (isLoading) {
    return (
      <LensCard padding="md" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="rounded-control-sm h-4 w-24" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="rounded-row h-16" />
        <Skeleton className="rounded-control-sm h-8" />
      </LensCard>
    );
  }
  if (!prompt) return null;

  const status: CardStatus = !isSignedIn
    ? "signed-out"
    : mine.isPending
      ? "loading"
      : mine.data
        ? "answered"
        : "open";

  return (
    <LensCard padding="md" className="no-wiki-tooltip space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <CardTitle icon={<ChatBubbleQuestion />}>Daily blurb</CardTitle>
        <Badge variant="secondary" className="max-w-full">
          <span className="truncate">{prompt.title}</span>
        </Badge>
      </div>
      <BlurbQuestion
        question={prompt.question}
        className="text-title-3 line-clamp-4 font-normal [@media(max-height:960px)]:line-clamp-3"
      />
      <BlurbCardActions count={prompt._count.responses} status={status} onOpen={setIntent} />
      <BlurbSheet
        prompt={prompt}
        intent={intent}
        myBlurb={mine.data ?? null}
        onClose={() => setIntent("closed")}
      />
    </LensCard>
  );
}

/** The prompt as a pull quote: an oversized tinted opening mark hangs in the gutter beside the text. */
function BlurbQuestion({
  question,
  className,
  ...props
}: ComponentProps<"blockquote"> & { question: string }) {
  return (
    <blockquote {...props} className={cn("text-label relative pl-8 text-pretty", className)}>
      <span
        aria-hidden
        className="text-tint text-display absolute top-0 left-0 leading-none font-extrabold select-none"
      >
        &ldquo;
      </span>
      {question}
    </blockquote>
  );
}

function BlurbCardActions({
  count,
  status,
  onOpen,
}: {
  count: number;
  status: CardStatus;
  onOpen: (intent: SheetIntent) => void;
}) {
  if (status === "loading") return <Skeleton className="rounded-control-sm h-8" />;

  const read =
    count > 0 ? (
      <Button
        size="sm"
        variant={status === "open" ? "ghost" : "secondary"}
        className={cn(TAP, "tabular-nums", status === "signed-out" && "flex-1")}
        onClick={() => onOpen("read")}
      >
        {status === "open" ? blurbCount(count) : `Read ${blurbCount(count)}`}
      </Button>
    ) : null;

  if (status === "answered") {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-success-ink text-footnote flex items-center gap-1.5">
          <CheckCircle aria-hidden className="size-4" />
          You answered
        </span>
        {read}
      </div>
    );
  }
  if (status === "signed-out") {
    return (
      read ?? (
        <p className="text-footnote text-label-secondary">
          No blurbs yet. Sign in to write the first.
        </p>
      )
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" className={cn(TAP, "flex-1")} onClick={() => onOpen("write")}>
        <EditPencil aria-hidden />
        Write a blurb
      </Button>
      {read}
    </div>
  );
}

function BlurbSheet({
  prompt,
  intent,
  myBlurb,
  onClose,
}: {
  prompt: DailyPrompt;
  intent: SheetIntent;
  myBlurb: MyBlurb | null;
  onClose: () => void;
}) {
  const { isSignedIn } = useUser();
  // Lives here, not in the form, so a draft survives closing and reopening the sheet.
  const [draft, setDraft] = useState("");

  return (
    <Sheet open={intent !== "closed"} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="flex flex-col gap-6 overflow-y-auto"
        onOpenAutoFocus={(e) => {
          // Reading should not raise the keyboard by focusing the compose field.
          if (intent === "read") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }
        }}
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="text-title-2">{prompt.title}</SheetTitle>
          <SheetDescription asChild className="text-body text-label">
            <BlurbQuestion question={prompt.question} />
          </SheetDescription>
        </SheetHeader>

        {!isSignedIn ? (
          <p className="text-footnote text-label-secondary">Sign in to write a blurb.</p>
        ) : myBlurb ? (
          <Card variant="well" padding="md" className="space-y-1.5">
            <p className="text-success-ink text-subhead flex items-center gap-1.5">
              <CheckCircle aria-hidden className="size-4" />
              Your blurb
            </p>
            <p className="text-label text-callout wrap-anywhere whitespace-pre-wrap">
              {myBlurb.content}
            </p>
          </Card>
        ) : (
          <BlurbComposer
            promptId={prompt.id}
            text={draft}
            setText={setDraft}
            autoFocus={intent === "write"}
          />
        )}

        <BlurbFeed promptId={prompt.id} total={prompt._count.responses} />

        <div className="border-separator mt-auto flex items-center justify-between border-t pt-4">
          <Link
            href={`/blurbs/${prompt.slug}`}
            className="text-tint text-footnote inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
          >
            <OpenNewWindow aria-hidden className="size-3.5" />
            Open the topic
          </Link>
          <Link
            href="/blurbs"
            className="text-label-secondary hover:text-label text-footnote duration-fast inline-flex items-center gap-1 transition-colors"
          >
            All topics
            <NavArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BlurbComposer({
  promptId,
  text,
  setText,
  autoFocus,
}: {
  promptId: string;
  text: string;
  setText: (text: string) => void;
  autoFocus: boolean;
}) {
  const utils = api.useUtils();
  const submit = api.blurbs.submitResponse.useMutation({
    onSuccess: () => {
      setText("");
      void utils.blurbs.getMyResponse.invalidate({ promptId });
      void utils.blurbs.getResponsesForPrompt.invalidate({ promptId });
      void utils.blurbs.getDailyPrompt.invalidate();
      void utils.blurbs.getActivePrompts.invalidate();
      void utils.blurbs.getBlurbCount.invalidate();
    },
  });

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate({ promptId, content: text });
      }}
    >
      <label htmlFor="daily-blurb-text" className="text-subhead text-label block">
        Your blurb
      </label>
      <Card
        variant="well"
        padding="none"
        className="focus-within:outline-tint focus-within:outline-2"
      >
        <textarea
          id="daily-blurb-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Answer for your nation"
          maxLength={MAX_BLURB}
          rows={5}
          autoFocus={autoFocus}
          className="text-label placeholder:text-label-tertiary text-body block w-full resize-none bg-transparent px-3 py-2.5 focus:outline-none"
        />
      </Card>
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-footnote tabular-nums",
            text.length > MAX_BLURB * 0.9 ? "text-caution" : "text-label-tertiary"
          )}
        >
          {text.length} / {MAX_BLURB}
        </span>
        <Button type="submit" size="sm" className={TAP} disabled={!text.trim() || submit.isPending}>
          {submit.isPending ? (
            <Loader aria-hidden className="animate-spin" />
          ) : (
            <Send aria-hidden />
          )}
          {submit.isPending ? "Posting" : "Post blurb"}
        </Button>
      </div>
      {submit.error && (
        <p role="alert" className="text-footnote text-destructive">
          {submit.error.message}
        </p>
      )}
    </form>
  );
}

function BlurbFeed({ promptId, total }: { promptId: string; total: number }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    api.blurbs.getResponsesForPrompt.useInfiniteQuery(
      { promptId, limit: 10, featuredFirst: true },
      { getNextPageParam: (page) => page.nextCursor }
    );
  const responses = data?.pages.flatMap((page) => page.responses) ?? [];

  return (
    <section aria-labelledby="daily-blurb-feed" className="space-y-1">
      <h3 id="daily-blurb-feed" className="text-headline text-label tabular-nums">
        {blurbCount(total)}
      </h3>
      {isLoading ? (
        <div className="space-y-3 py-3">
          <Skeleton className="rounded-row h-14" />
          <Skeleton className="rounded-row h-14" />
        </div>
      ) : responses.length === 0 ? (
        <EmptyState
          compact
          icon={<ChatBubbleQuestion />}
          title="No blurbs yet"
          message="Be the first nation to answer."
        />
      ) : (
        <ul data-content="feed">
          {responses.map((r) => (
            <BlurbRow key={r.id} response={r} />
          ))}
        </ul>
      )}
      {hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(TAP, "w-full")}
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading" : "Show more"}
        </Button>
      )}
    </section>
  );
}

type LinkedArticle = { title: string; url: string };

function linkedArticles(value: BlurbResponse["linkedArticles"]): LinkedArticle[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((a) =>
    a &&
    typeof a === "object" &&
    !Array.isArray(a) &&
    typeof a.title === "string" &&
    typeof a.url === "string"
      ? [{ title: a.title, url: a.url }]
      : []
  );
}

function BlurbRow({ response: r }: { response: BlurbResponse }) {
  const country = r.country ?? r.user?.country ?? null;
  const name = country?.name ?? "Unknown nation";
  const articles = linkedArticles(r.linkedArticles);

  return (
    <li className="space-y-1.5 py-3">
      <div className="flex items-center gap-2">
        {country?.flag ? (
          <img
            src={assetUrl(country.flag) ?? undefined}
            alt=""
            className="h-3.5 w-5 shrink-0 rounded-xs object-cover"
          />
        ) : (
          <UnifiedCountryFlag
            showTooltip={false}
            countryName={name}
            size="sm"
            className="shrink-0"
          />
        )}
        <span className="text-subhead text-label truncate font-medium">{name}</span>
        {r.featured && <Badge variant="warning">Featured</Badge>}
        <span className="text-caption text-label-tertiary ml-auto shrink-0 tabular-nums">
          {timeAgo(r.createdAt)}
        </span>
      </div>
      <p className="text-label text-callout wrap-anywhere whitespace-pre-wrap select-text">
        {r.content}
      </p>
      {articles.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {articles.map((article) => (
            <Link
              key={article.url}
              href={article.url}
              className="text-tint text-footnote inline-flex items-center gap-1 underline underline-offset-2"
            >
              <OpenNewWindow aria-hidden className="size-3.5" />
              {article.title}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}
