"use client";

import { useState } from "react";
import Link from "next/link";
import { ChatLines, Internet, Link as LinkIcon, Map as MapIcon, OpenBook } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { DiscordLogomark } from "~/lib/navigation/icons/DiscordLogomark";
import type { RealmLinkKind } from "~/lib/realms/realm-community";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Progress } from "~/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn, formatPercent, formatYears } from "~/lib/utils";
import { formatCompact, timeAgo } from "~/lib/format/compact";
import { assetUrl } from "~/lib/base-path";

type Overview = NonNullable<RouterOutputs["realms"]["region"]["overview"]>;
type Happening = RouterOutputs["realms"]["region"]["happenings"]["items"][number];

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-separator bg-surface rounded-card border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-label text-headline">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const nationHref = (nation: { slug: string | null; id: string }) =>
  `/countries/${nation.slug ?? nation.id}`;

const LINK_ICONS: Record<RealmLinkKind, React.ComponentType<{ className?: string }>> = {
  forum: ChatLines,
  discord: DiscordLogomark,
  wiki: OpenBook,
  map: MapIcon,
  website: Internet,
  other: LinkIcon,
};

/** The realm's community links (forum, Discord, wiki, map...), set by its staff in Manage. */
export function CommunityPanel({ overview }: { overview: Overview }) {
  if (!overview.links?.length) return null;
  return (
    <Panel title="Community">
      <ul className="flex flex-col gap-1">
        {overview.links.map((link) => {
          const Icon = LINK_ICONS[link.kind];
          return (
            <li key={`${link.kind}:${link.url}`}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:bg-fill-4 rounded-row text-label text-body flex items-center gap-2 p-2"
              >
                <Icon className="text-label-secondary size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{link.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function OfficersPanel({ overview }: { overview: Overview }) {
  const { founder, officers } = overview;
  // A staff-run realm without officers: the header already says so.
  if (!founder && officers.length === 0) return null;
  return (
    <Panel title="Officers">
      <ul className="flex flex-col gap-2">
        <li className="flex items-baseline justify-between gap-2">
          <span className="text-label-secondary text-footnote">Founder</span>
          <span className="text-label text-body truncate">
            {founder ? (
              founder.nation ? (
                <Link href={nationHref(founder.nation)} className="hover:underline">
                  {founder.name}
                </Link>
              ) : (
                founder.name
              )
            ) : (
              "Administered by IxStats staff"
            )}
          </span>
        </li>
        {officers.map((officer) => (
          <li
            key={`${officer.title}:${officer.name}`}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="text-label-secondary text-footnote truncate">{officer.title}</span>
            <span className="text-label text-body truncate">
              {officer.nation ? (
                <Link href={nationHref(officer.nation)} className="hover:underline">
                  {officer.name}
                </Link>
              ) : (
                officer.name
              )}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The realm-scoped World Census: the realm's top nations in one switchable category. */
const CENSUS_CATEGORIES = [
  { id: "totalGdp", label: "Economy (GDP)", fmt: "currency" },
  { id: "gdpPerCapita", label: "GDP per capita", fmt: "currency" },
  { id: "population", label: "Population", fmt: "number" },
  { id: "gdpGrowth", label: "Economic growth", fmt: "percent" },
  { id: "avgIncome", label: "Average income", fmt: "currency" },
  { id: "lifeExpectancy", label: "Life expectancy", fmt: "years" },
  { id: "literacyRate", label: "Literacy", fmt: "percent" },
  { id: "economicVitality", label: "Economic vitality", fmt: "number" },
  { id: "wellbeing", label: "Wellbeing", fmt: "number" },
  { id: "approval", label: "Government approval", fmt: "percent" },
] as const;

type CensusId = (typeof CENSUS_CATEGORIES)[number]["id"];

function censusValue(fmt: string, value: number | null) {
  if (value === null) return "n/a";
  if (fmt === "currency") return `$${formatCompact(value)}`;
  if (fmt === "percent") return formatPercent(value);
  if (fmt === "years") return formatYears(value);
  return formatCompact(Math.round(value * 10) / 10);
}

export function CensusPanel({ slug }: { slug: string }) {
  const [metric, setMetric] = useState<CensusId>("totalGdp");
  const category = CENSUS_CATEGORIES.find((c) => c.id === metric)!;
  const { data, isLoading } = api.achievements.getCountryLeaderboard.useQuery({
    metric,
    limit: 5,
    realm: slug,
  });
  return (
    <Panel
      title="World Census"
      action={
        <Select value={metric} onValueChange={(v) => setMetric(v as CensusId)}>
          <SelectTrigger size="sm" aria-label="Census category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {CENSUS_CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {isLoading ? (
        <p className="text-label-secondary text-footnote">Loading…</p>
      ) : !data?.length ? (
        <p className="text-label-secondary text-footnote">No nation has a figure for this yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {data.slice(0, 5).map((row, index) => (
            <li key={row.countryId} className="flex items-center gap-2">
              <span className="text-label-secondary text-footnote w-4 tabular-nums">
                {index + 1}
              </span>
              <Link
                href={`/countries/${row.countryId}`}
                className="text-label text-body min-w-0 flex-1 truncate hover:underline"
              >
                {row.countryName}
              </Link>
              <span className="text-label-secondary text-footnote tabular-nums">
                {censusValue(category.fmt, row.value)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <Link
        href={`/leaderboards?realm=${encodeURIComponent(slug)}`}
        className="text-tint text-footnote mt-3 inline-block hover:underline"
      >
        Full rankings
      </Link>
    </Panel>
  );
}

export function PollPanel({ slug, overview }: { slug: string; overview: Overview }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const poll = overview.poll;
  const [chosen, setChosen] = useState<string[]>([]);
  const vote = api.polls.vote.useMutation({
    onSuccess: () => {
      notify.success("Vote cast");
      setChosen([]);
      void utils.realms.region.overview.invalidate({ slug });
    },
    onError: (error) => notify.error("Vote failed", error.message),
  });
  if (!poll) return null;

  const voted = poll.userVotedOptionIds.length > 0;
  const showResults = voted || !poll.canVote;
  const toggle = (id: string) =>
    setChosen((current) =>
      poll.multiple
        ? current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id]
        : [id]
    );

  return (
    <Panel title="Realm poll">
      <p className="text-label text-body font-medium">{poll.question}</p>
      {poll.description && (
        <p className="text-label-secondary text-footnote mt-1">{poll.description}</p>
      )}
      <ul className="mt-3 flex flex-col gap-2">
        {poll.options.map((option) => {
          const share = poll.totalVotes > 0 ? (option.votes / poll.totalVotes) * 100 : 0;
          return (
            <li key={option.id}>
              {showResults ? (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2">
                    <span
                      className={cn(
                        "text-body",
                        poll.userVotedOptionIds.includes(option.id)
                          ? "text-label font-medium"
                          : "text-label-secondary"
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="text-label-secondary text-footnote tabular-nums">
                      {Math.round(share)}%
                    </span>
                  </div>
                  <Progress value={share} aria-label={`${option.label}: ${Math.round(share)}%`} />
                </div>
              ) : (
                <label className="text-label text-body flex items-center gap-2">
                  <Checkbox
                    checked={chosen.includes(option.id)}
                    onCheckedChange={() => toggle(option.id)}
                  />
                  {option.label}
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-label-secondary text-footnote tabular-nums">
          {poll.totalVotes.toLocaleString()} vote{poll.totalVotes === 1 ? "" : "s"}
          {poll.endDate &&
            ` · ${poll.expired ? "ended" : "ends"} ${new Date(poll.endDate).toLocaleDateString()}`}
        </span>
        {!showResults && (
          <Button
            size="sm"
            disabled={chosen.length === 0 || vote.isPending}
            onClick={() => vote.mutate({ pollId: poll.id, optionIds: chosen })}
          >
            Vote
          </Button>
        )}
      </div>
      {!voted && !poll.canVote && !poll.expired && (
        <p className="text-label-secondary text-footnote mt-2">
          Owners of a nation in this realm can vote.
        </p>
      )}
    </Panel>
  );
}

export function EmbassiesPanel({ overview }: { overview: Overview }) {
  if (overview.embassies.length === 0) return null;
  return (
    <Panel title="Embassies">
      <ul className="flex flex-col gap-1">
        {overview.embassies.map((realm) => (
          <li key={realm.slug}>
            <Link
              href={`/r/${encodeURIComponent(realm.slug)}`}
              className="hover:bg-fill-4 rounded-row text-label text-body flex items-center gap-2 p-2"
            >
              {realm.thumbnail ? (
                <img
                  src={assetUrl(realm.thumbnail) ?? ""}
                  alt=""
                  className="size-5 rounded-sm object-cover"
                />
              ) : (
                <span className="bg-fill-3 size-5 rounded-sm" aria-hidden="true" />
              )}
              <span className="truncate">{realm.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** One happening: its text (linked when it has a page) and how long ago. */
export function HappeningLine({ item }: { item: Happening }) {
  return (
    <li className="text-footnote">
      {item.href ? (
        <Link href={item.href} className="text-label hover:underline">
          {item.text}
        </Link>
      ) : (
        <span className="text-label">{item.text}</span>
      )}
      <span className="text-label-secondary"> · {timeAgo(item.at)}</span>
    </li>
  );
}

export function HappeningsPanel({ slug }: { slug: string }) {
  const { data, isLoading } = api.realms.region.happenings.useQuery({ slug });
  const items = data?.items;
  return (
    <Panel
      title="Happenings"
      action={
        items?.length ? (
          <Link
            href={`/r/${encodeURIComponent(slug)}/happenings`}
            className="text-tint text-footnote hover:underline"
          >
            See all
          </Link>
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="text-label-secondary text-footnote">Loading…</p>
      ) : !items?.length ? (
        <p className="text-label-secondary text-footnote">Nothing has happened here yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <HappeningLine key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
