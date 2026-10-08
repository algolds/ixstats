"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { createUrl } from "~/lib/utils";
import { ThinktankFeedTab } from "~/components/thinktanks/ThinktankFeedTab";
import { ThinktankChatTab } from "~/components/thinktanks/ThinktankChatTab";
import { RealmFeed } from "../../_components/RealmFeed";
import { SegmentedControl } from "~/components/ui/segmented-control";

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
  const { data: overview } = api.realms.region.overview.useQuery({ slug });
  const restriction = overview?.viewer.boardRestriction ?? null;
  const { data: group } = api.thinkpages.getThinktankById.useQuery(
    { groupId: board?.groupId ?? "" },
    { enabled: Boolean(board?.groupId) }
  );
  usePageTitle({ title: board ? `${board.realm.name} · Board` : "Realm board" });

  if (isLoading) return <p className="text-label-secondary text-body">Loading board…</p>;
  if (error?.data?.code === "NOT_FOUND") notFound();
  if (!board)
    return <p className="text-label-secondary text-body">The board could not be loaded.</p>;

  const realmHref = `/r/${encodeURIComponent(board.realm.slug)}`;
  const visibleTabs = TABS.filter((t) => !t.membersOnly || board.canPost);
  const notice = restriction ? (
    <>
      Your nation is {restriction.kind === "ban" ? "banned from" : "muted on"} this board
      {restriction.until
        ? ` until ${new Date(restriction.until).toLocaleDateString()}`
        : " until a moderator lifts it"}
      {restriction.reason ? `: ${restriction.reason}` : "."}
    </>
  ) : currentUserId ? (
    <>
      Only owners of a nation in {board.realm.name} can post here.{" "}
      <Link href={`${realmHref}/nations`} className="text-label font-medium underline">
        Claim a nation
      </Link>{" "}
      to join the board.
    </>
  ) : (
    <>
      <Link
        href={`/sign-in?redirect_url=${encodeURIComponent(createUrl(`/r/${slug}/board`))}`}
        className="text-label font-medium underline"
      >
        Sign in
      </Link>{" "}
      and claim a nation in {board.realm.name} to post here.
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label-secondary text-footnote">
          {overview ? `${overview.stats.nations.toLocaleString()} nations · ` : ""}
          {board.canModerate
            ? "You moderate this board"
            : board.canPost && !restriction
              ? "You can post here"
              : "Read-only"}
        </p>
        <SegmentedControl
          aria-label="Board sections"
          size="sm"
          value={tab}
          onValueChange={setTab}
          options={visibleTabs.map((t) => ({ value: t.id, label: t.label }))}
        />
      </div>

      <section className="border-separator bg-surface rounded-card overflow-hidden border">
        {tab === "board" && (
          <ThinktankFeedTab
            groupId={board.groupId}
            groupName={`${board.realm.name} board`}
            isMember={board.canPost && !restriction}
            canReadFeed
            allowPersonaPosting={board.ownedCountryIds.length > 0}
            accountCountryIds={board.ownedCountryIds}
            canModerate={board.canModerate}
            currentUserId={currentUserId}
            readOnlyNotice={notice}
            embassyPosting={(overview?.embassies.length ?? 0) > 0}
          />
        )}
        {tab === "chat" && board.canPost && (
          <ThinktankChatTab
            conversationId={group?.conversationId}
            groupName={`${board.realm.name} board`}
            currentUserId={currentUserId}
          />
        )}
        {tab === "feed" && (
          <div className="p-4">
            <p className="text-label-secondary text-footnote mb-3">
              Posts by the nations of {board.realm.name}, and this board.
            </p>
            <RealmFeed realmId={board.realm.id} />
          </div>
        )}
      </section>
    </div>
  );
}
