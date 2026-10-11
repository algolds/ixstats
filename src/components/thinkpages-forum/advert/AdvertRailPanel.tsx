"use client";

import Link from "next/link";
import { Group } from "iconoir-react";
import { realmHref } from "~/app/realms/_components/realm-directory";
import { assetUrl } from "~/lib/base-path";
import { handleProfileHref } from "~/lib/thinkpages-forum/links";
import { api, type RouterOutputs } from "~/trpc/react";
import { AuthorFlag } from "../AuthorMark";
import { ForumAvatar } from "../ForumAvatar";
import { RailPanel } from "../shell";

type Overview = NonNullable<RouterOutputs["realms"]["region"]["overview"]>;
type Person = Pick<Overview["officers"][number], "name" | "handle" | "nation">;

interface Member extends Person {
  key: string;
  role: string;
}

/** The founder first (a staff-run realm has none), then the officers with the titles the realm gave them. */
function membersOf(overview: Overview | null | undefined): Member[] {
  if (!overview) return [];
  const founder: Member[] = overview.founder
    ? [{ ...overview.founder, key: "founder", role: "Founder" }]
    : [];
  return [
    ...founder,
    ...overview.officers.map((officer, index) => ({
      key: `officer-${index}`,
      role: officer.title,
      name: officer.name,
      handle: officer.handle,
      nation: officer.nation,
    })),
  ];
}

/** One public realm role: the player's avatar and nation flag, their name (a Passport link when they have a handle) and role. */
function MemberRow({ member }: { member: Member }) {
  const flag = member.nation?.flag ? assetUrl(member.nation.flag) : null;
  return (
    <li className="flex items-center gap-3 px-2 py-2 pointer-coarse:min-h-11">
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <ForumAvatar name={member.name} size="xs" />
        {flag ? <AuthorFlag url={flag} /> : null}
      </span>
      <span className="text-callout min-w-0 flex-1 truncate">
        {member.handle ? (
          <Link href={handleProfileHref(member.handle)} className="hover:underline">
            {member.name}
          </Link>
        ) : (
          member.name
        )}
      </span>
      <span className="text-callout text-label-secondary truncate">{member.role}</span>
    </li>
  );
}

/**
 * "About <realm>": the realm's founder and officers (live from the overview, public realm roles only; a persona never
 * appears) and a link to the realm page, which shows before the overview arrives.
 */
export function AdvertRailPanel({
  realmSlug,
  realmName,
}: {
  realmSlug: string;
  realmName: string;
}) {
  const { data: overview } = api.realms.region.overview.useQuery({ slug: realmSlug });
  const members = membersOf(overview);
  return (
    <RailPanel title={`About ${realmName}`} icon={<Group />}>
      <div className="space-y-2">
        {members.length > 0 ? (
          <ul className="-mx-2">
            {members.map((member) => (
              <MemberRow key={member.key} member={member} />
            ))}
          </ul>
        ) : null}
        <Link
          href={realmHref(realmSlug)}
          className="text-tint text-callout inline-flex items-center hover:underline pointer-coarse:min-h-11"
        >
          Open the realm page
        </Link>
      </div>
    </RailPanel>
  );
}
