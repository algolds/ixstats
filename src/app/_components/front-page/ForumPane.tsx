"use client";

import { ChatLines } from "iconoir-react";
import { LatestActivityList } from "~/components/thinkpages-forum/home/HomeRail";
import { api } from "~/trpc/react";
import { FADE_IN_ROWS, Pane, PaneBody } from "./Pane";

const SHOWN = 5;
const REFRESH_MS = 60_000;

/** The newest forum posts across ThinkPages' sitewide boards. */
export function ForumPane() {
  const query = api.thinkpagesForum.latestActivity.useQuery(
    { limit: SHOWN },
    { refetchInterval: REFRESH_MS }
  );
  const items = query.data ?? [];
  return (
    <Pane
      app="thinkpages"
      icon={<ChatLines />}
      title="ThinkPages"
      link={{ href: "/thinkpages", label: "Forum" }}
    >
      <PaneBody
        query={query}
        what="forum posts"
        empty={items.length === 0 ? "No forum posts yet." : null}
      >
        <LatestActivityList items={items} className={FADE_IN_ROWS} />
      </PaneBody>
    </Pane>
  );
}
