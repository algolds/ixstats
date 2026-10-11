import { Heart } from "iconoir-react";
import { EmptyState } from "~/components/ui/empty-state";
import { reactionLabel } from "~/lib/thinkpages-forum/reactions";
import { ForumAvatar } from "../ForumAvatar";
import { ReactionGlyph, type EmojiList } from "./ReactionGlyph";

export interface Reactor {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  flagUrl: string | null;
}
export interface ReactorGroup {
  type: string;
  count: number;
  reactors: Reactor[];
}

interface ReactorRowProps {
  reactor: Reactor;
  type: string;
  emojis?: EmojiList | undefined;
}

/** One reactor: the player's picture, name, flag and handle, and the reaction they gave. */
export function ReactorRow({ reactor, type, emojis }: ReactorRowProps) {
  return (
    <li className="rounded-row flex items-center gap-3 p-2">
      <ForumAvatar name={reactor.name} avatarUrl={reactor.avatarUrl} size="md" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="text-headline text-label min-w-0 truncate">{reactor.name}</span>
          {reactor.flagUrl ? (
            <img
              src={reactor.flagUrl}
              alt=""
              width={18}
              height={12}
              className="rounded-control-sm h-3 w-[18px] shrink-0 object-cover"
            />
          ) : null}
        </span>
        {reactor.handle ? (
          <span className="text-footnote text-label-secondary truncate">@{reactor.handle}</span>
        ) : null}
      </div>
      <ReactionGlyph type={type} emojis={emojis} className="size-4" />
    </li>
  );
}

interface ReactorListProps {
  groups: readonly ReactorGroup[];
  emojis?: EmojiList | undefined;
}

/** The reactors of the shown groups, with a note under a group that has more people than are listed. */
export function ReactorList({ groups, emojis }: ReactorListProps) {
  if (groups.length === 0) return <EmptyState compact icon={<Heart />} title="No reactions yet" />;
  return (
    <ul className="flex flex-col gap-1">
      {groups.map((group) => (
        <ReactorGroupRows key={group.type} group={group} emojis={emojis} />
      ))}
    </ul>
  );
}

function ReactorGroupRows({
  group,
  emojis,
}: {
  group: ReactorGroup;
  emojis?: EmojiList | undefined;
}) {
  return (
    <>
      {group.reactors.map((reactor) => (
        <ReactorRow key={reactor.id} reactor={reactor} type={group.type} emojis={emojis} />
      ))}
      {group.count > group.reactors.length ? (
        <li>
          <p className="text-footnote text-label-secondary px-2 py-1">
            {`Showing the latest ${group.reactors.length} of ${group.count} ${reactionLabel(group.type)}`}
          </p>
        </li>
      ) : null}
    </>
  );
}
