"use client";

import { Medal, Page } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { api, type RouterOutputs } from "~/trpc/react";
import { ForumAvatar } from "../ForumAvatar";
import { RailPanel } from "../shell";

type Category = RouterOutputs["thinkpagesForum"]["category"]["category"];

/** The board's description, whether it is in character, and who may start a thread. */
export function AboutPanel({ category }: { category: Category }) {
  const rule =
    category.postRole === "staff"
      ? "Only staff can start threads here."
      : "Any member can start threads here.";
  return (
    <RailPanel title="About this board" icon={<Page />}>
      <div className="space-y-3">
        {category.description ? (
          <p className="text-body text-label">{category.description}</p>
        ) : null}
        {category.style === "ic" ? <Badge variant="secondary">In character</Badge> : null}
        <p className="text-footnote text-label-secondary">{rule}</p>
      </div>
    </RailPanel>
  );
}

interface TopPostersPanelProps {
  categoryKey: string;
  realm?: string;
}

/** The board's most active members this month. Left out when nobody has posted. */
export function TopPostersPanel({ categoryKey, realm }: TopPostersPanelProps) {
  const { data } = api.thinkpagesForum.boardTopPosters.useQuery({ key: categoryKey, realm });
  const posters = data?.posters ?? [];
  return (
    <RailPanel title="Top posters this month" icon={<Medal />}>
      {data && posters.length > 0 ? (
        <ul className="-mx-2">
          {posters.map((poster) => {
            const author = data.authors.users[poster.authorUserId];
            const name = author?.name ?? "Member";
            return (
              <li
                key={poster.authorUserId}
                className="flex items-center gap-3 px-2 py-2 pointer-coarse:min-h-11"
              >
                <ForumAvatar name={name} avatarUrl={author?.avatarUrl} size="sm" />
                <span className="text-body text-label min-w-0 flex-1 truncate">{name}</span>
                <span className="text-callout text-label-secondary tabular-nums">
                  {`${poster.postCount} ${poster.postCount === 1 ? "post" : "posts"}`}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </RailPanel>
  );
}
