"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { cn, createUrl } from "~/lib/utils";
import { ThinktankFeedTab } from "~/components/thinktanks/ThinktankFeedTab";
import { ThinktankChatTab } from "~/components/thinktanks/ThinktankChatTab";
import { RealmFeed } from "../_components/RealmFeed";

type BoardTab = "board" | "chat" | "feed";

const TABS: Array<{ id: BoardTab; label: string; membersOnly?: boolean }> = [
  { id: "board", label: "Board" },
  { id: "chat", label: "Chat", membersOnly: true },
  { id: "feed", label: "Realm feed" },
];

/** A realm's board (the NationStates regional message board): its ThinkTank feed, chat, and the realm feed. */
export default function RealmBoardPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const { user } = useUser();
  const currentUserId = user?.id ?? "";
  const [tab, setTab] = useState<BoardTab>("board");
  const { data: board, isLoading, error } = api.realms.getBoard.useQuery({ slug });
  const { data: group } = api.thinkpages.getThinktankById.useQuery(
    { groupId: board?.groupId ?? "" },
    { enabled: Boolean(board?.groupId) }
  );
  usePageTitle({ title: board ? `${board.realm.name} · Board` : "Realm board" });

  if (isLoading)
    return (
      <div className="text-muted-foreground mx-auto max-w-5xl p-8 text-sm">Loading board…</div>
    );
  if (error?.data?.code === "NOT_FOUND") notFound();
  if (!board)
    return (
      <div className="text-muted-foreground mx-auto max-w-5xl p-8 text-sm">
        The board could not be loaded.
      </div>
    );

  const realmHref = createUrl(`/r/${encodeURIComponent(board.realm.slug)}`);
  const visibleTabs = TABS.filter((t) => !t.membersOnly || board.canPost);
  const notice = currentUserId ? (
    <>
      Only owners of a nation in {board.realm.name} can post here.{" "}
      <Link href={realmHref} className="text-foreground font-medium underline">
        Claim a nation
      </Link>{" "}
      to join the board.
    </>
  ) : (
    <>
      <Link
        href={createUrl(
          `/sign-in?redirect_url=${encodeURIComponent(createUrl(`/r/${slug}/board`))}`
        )}
        className="text-foreground font-medium underline"
      >
        Sign in
      </Link>{" "}
      and claim a nation in {board.realm.name} to post here.
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-8">
      <header className="border-border bg-card/70 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5 backdrop-blur-xl">
        <div>
          <Link href={realmHref} className="text-muted-foreground hover:text-foreground text-xs">
            ← {board.realm.name}
          </Link>
          <h1 className="text-foreground text-xl font-bold tracking-tight">
            {board.realm.name} Board
          </h1>
          <p className="text-muted-foreground text-xs">
            {group ? `${group.memberCount.toLocaleString()} members · ` : ""}
            {board.canModerate
              ? "You moderate this board"
              : board.canPost
                ? "You can post here"
                : "Read-only"}
          </p>
        </div>
        <nav className="bg-muted/40 flex gap-1 rounded-xl p-1" aria-label="Board sections">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold",
                tab === t.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="border-border bg-card/40 overflow-hidden rounded-2xl border">
        {tab === "board" && (
          <ThinktankFeedTab
            groupId={board.groupId}
            groupName={`${board.realm.name} Board`}
            isMember={board.canPost}
            canReadFeed
            allowPersonaPosting={board.ownedCountryIds.length > 0}
            accountCountryIds={board.ownedCountryIds}
            canModerate={board.canModerate}
            currentUserId={currentUserId}
            readOnlyNotice={notice}
          />
        )}
        {tab === "chat" && board.canPost && (
          <ThinktankChatTab
            conversationId={group?.conversationId}
            groupName={`${board.realm.name} Board`}
            currentUserId={currentUserId}
          />
        )}
        {tab === "feed" && (
          <div className="p-4">
            <p className="text-muted-foreground mb-3 text-xs">
              Posts by the nations of {board.realm.name}, and this board.
            </p>
            <RealmFeed realmId={board.realm.id} />
          </div>
        )}
      </section>
    </div>
  );
}
