"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Community } from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { useRealmBoardLive } from "~/hooks/useRealmBoardLive";
import { assetUrl } from "~/lib/base-path";
import { upsertBoardMessage } from "~/lib/thinkpages-forum/board-live";
import { FORUM_HOME, realmHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { PHONE_QUERY } from "../composer";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import type { ModeratorTools } from "../ModeratorMenu";
import { RealmSwitcher } from "../RealmSwitcher";
import { DockSpacer, ForumPage } from "../shell";
import { BoardChips } from "./BoardChips";
import { BoardComposer, type BoardComposerHandle, type BoardPostInput } from "./BoardComposer";
import { BoardFeed } from "./BoardFeed";
import { boardQuoteText } from "./board-quote";
import { RealmRail, RECENT_ACTIONS_SHOWN, railHasContent } from "./RealmRail";
import type { BoardData, BoardMessageData, BoardQuote, ReplyTarget } from "./types";
import { useScrollToMessageHash } from "./useScrollToMessageHash";

/** The realm's emblem (or its thumbnail, as the server resolves it); a tinted realm mark without either. */
function Emblem({ url }: { url: string | null }) {
  const src = assetUrl(url);
  return (
    <div className="bg-tint-fill text-tint rounded-card flex size-16 shrink-0 items-center justify-center overflow-hidden">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Community aria-hidden className="size-8" />
      )}
    </div>
  );
}

/** "31 members · 6 online · You're a member": the online count only while the socket is up. */
function factsOf(data: BoardData, online: number | null): string {
  const { memberCount } = data.realm;
  const standing = data.access.isMember
    ? "You're a member"
    : data.access.isVisitor
      ? "Visitor"
      : null;
  return [
    memberCount === 1 ? "1 member" : `${memberCount} members`,
    online === null ? null : `${online} online`,
    standing,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function OtherRealms({ current }: { current: string }) {
  const { data } = api.thinkpagesForum.realms.useQuery();
  if (!data) return null;
  // A realm opened by URL may be unlisted; keep it selectable so the trigger shows its name.
  return <RealmSwitcher realms={data.realms} value={current} hrefFor={realmHref} />;
}

interface LandingBodyProps {
  slug: string;
  /** The board as the first load returned it; the query's own copy takes over from the cache. */
  loaded: BoardData;
}

/** The board kept live: polled while the socket is down, merged by the live hook while it is up. */
function LandingBody({ slug, loaded }: LandingBodyProps) {
  const utils = api.useUtils();
  const { isSignedIn } = useUser();
  const live = useRealmBoardLive(loaded.realm.id);
  const { data = loaded } = api.thinkpagesForum.getBoard.useQuery(
    { realm: slug },
    { refetchInterval: live.refetchInterval }
  );
  const { realm, access } = data;
  const phone = useMediaQuery(PHONE_QUERY);
  const { data: sections } = api.thinkpagesForum.realmSection.useQuery({ realm: slug });
  // A realm without a row (IxWorld, synthesized) has no happenings to read; skip the request.
  const { data: happenings } = api.realms.region.happenings.useQuery(
    { slug, kinds: ["activity"], limit: RECENT_ACTIONS_SHOWN },
    { enabled: realm.hasRow, retry: false, refetchOnWindowFocus: false }
  );
  const boards = sections?.categories ?? [];
  // On a phone the boards are chips under the header, so the Info sheet does not list them again.
  const rail = {
    boards: phone ? [] : boards,
    online: live.online,
    actions: happenings?.items ?? [],
    // A realm without a row of its own (IxWorld, synthesized) has no settings to save.
    canManageSettings: access.canManageSettings && realm.hasRow,
  };
  usePageTitle({ title: realm.name });
  useScrollToMessageHash(data.messages.length);

  const composer = useRef<BoardComposerHandle>(null);
  const startConversation = useCallback(() => composer.current?.focus(), []);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [quote, setQuote] = useState<BoardQuote | null>(null);
  const [showLatest, setShowLatest] = useState(0);
  const { mutateAsync: postMessage } = api.thinkpagesForum.postBoardMessage.useMutation();
  const { mutateAsync: modEditPost } = api.thinkpagesForumMod.editPost.useMutation();

  const refresh = useCallback(async () => {
    await utils.thinkpagesForum.getBoard.invalidate();
  }, [utils]);

  const tools = useMemo<ModeratorTools>(
    () => ({
      category: { key: "board", name: "Board", realm: { slug: realm.slug, name: realm.name } },
      refresh,
      saveEdit: async (postId, html, note) => {
        await modEditPost({ postId, html, note });
        await refresh();
      },
    }),
    [realm.slug, realm.name, refresh, modEditPost]
  );

  const post = useCallback(
    async (input: BoardPostInput) => {
      const message = await postMessage({ realm: slug, ...input });
      // A poll in flight started before the post would overwrite the upsert with a board without the message.
      await utils.thinkpagesForum.getBoard.cancel({ realm: slug });
      // The live event for the same message merges by id, so it shows once whichever arrives first.
      utils.thinkpagesForum.getBoard.setData(
        { realm: slug },
        (old) =>
          old && {
            ...old,
            messages: upsertBoardMessage(old.messages, message, { complete: !old.hasMore }),
          }
      );
      setShowLatest((n) => n + 1);
    },
    [postMessage, utils, slug]
  );

  const startReply = useCallback(
    (message: BoardMessageData) =>
      setReplyTo({ postId: message.id, authorName: message.author.name }),
    []
  );
  const startQuote = useCallback((message: BoardMessageData) => {
    const text = boardQuoteText(message.author.name, message.contentHtml);
    if (text) setQuote((current) => ({ key: (current?.key ?? 0) + 1, text }));
  }, []);
  const clearReply = useCallback(() => setReplyTo(null), []);
  const clearQuote = useCallback(() => setQuote(null), []);
  const changed = useCallback(() => void refresh(), [refresh]);

  return (
    <ForumPage
      title={realm.name}
      leading={<Emblem url={realm.emblemUrl} />}
      breadcrumbs={<p className="tabular-nums">{factsOf(data, live.online)}</p>}
      back={{ href: FORUM_HOME, label: "ThinkPages" }}
      wideActions={<OtherRealms current={realm.slug} />}
      rail={railHasContent(rail) ? <RealmRail realm={realm} {...rail} /> : undefined}
    >
      {phone ? <BoardChips slug={realm.slug} boards={boards} /> : null}
      <BoardComposer
        ref={composer}
        realmName={realm.name}
        access={access}
        slowModeSeconds={realm.settings.slowModeSeconds}
        replyTo={replyTo}
        onClearReply={clearReply}
        quote={quote}
        onQuoteInserted={clearQuote}
        onTyping={live.sendTyping}
        onSubmit={post}
        docked={phone}
      />
      <BoardFeed
        realm={realm}
        data={data}
        typing={live.typing}
        paused={live.paused}
        signedIn={!!isSignedIn}
        tools={tools}
        showLatest={showLatest}
        onReply={startReply}
        onQuote={startQuote}
        onChanged={changed}
        onStart={startConversation}
      />
      {phone && access.canPost ? <DockSpacer /> : null}
    </ForumPage>
  );
}

/** A realm's landing page: its live board (composer and feed) under the realm's emblem, name and facts. */
export function RealmLanding({ realm }: { realm: string }) {
  const { data, isLoading, error, refetch } = api.thinkpagesForum.getBoard.useQuery({ realm });
  if (isLoading) return <ForumPageSkeleton blocks={2} />;
  if (!data) {
    return (
      <ForumLoadError
        notFound={error?.data?.code === "NOT_FOUND"}
        notFoundTitle="Realm not found"
        notFoundMessage="It may be private, or the link is incorrect."
        onRetry={() => void refetch()}
      />
    );
  }
  return <LandingBody slug={realm} loaded={data} />;
}
