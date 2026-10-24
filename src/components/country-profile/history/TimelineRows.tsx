import { formatDistanceToNow, isValid } from "date-fns";
import {
  Activity,
  ChatBubble as MessageSquare,
  CheckCircle,
  Flash as Zap,
  TriangleFlag as Flag,
  Globe,
  Heart,
  MapPin,
  Page,
  RssFeed as Rss,
  ShareAndroid as Share2,
  StatUp as TrendingUp,
  Trophy,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { DiscussedInBadge } from "~/components/action-links/DiscussedIn";
import { escapeHtml, sanitizeUserContent } from "~/lib/utils";
import type { CountryActivityItem } from "~/app/countries/[slug]/_types";
import type { ChronicleEntry, ChronicleKind } from "~/app/countries/[slug]/_utils/profileLayer";
import { CHRONICLE_KIND_LABEL } from "../labels";

type Icon = typeof Activity;

const KIND_ICON: Record<ChronicleKind, Icon> = {
  founding: Flag,
  story: MapPin,
  directive: Page,
  decision: CheckCircle,
  diplomacy: Globe,
};

const TYPE_ICON: Record<string, Icon> = {
  achievement: Trophy,
  milestone: Trophy,
  economic: TrendingUp,
  diplomatic: Globe,
  social: MessageSquare,
  event: Zap,
};

const ENGAGEMENT_ICON = { likes: Heart, comments: MessageSquare, shares: Share2 } as const;

/**
 * Text that may carry Discord custom emoji markup, as safe HTML: the emoji are lifted out as
 * placeholders before escaping, turned into <img> tags, then the whole is sanitised.
 */
function renderWithEmojis(text: string): string {
  if (!text) return "";
  const emojis: { placeholder: string; imgTag: string }[] = [];
  let idx = 0;
  const withPlaceholders = text.replace(
    /<(a)?:([a-zA-Z0-9_]+):(\d{17,20})>/g,
    (_match: string, animated: string, name: string, id: string) => {
      const ext = animated ? "gif" : "png";
      const imgTag = `<img src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt=":${name}:" class="inline-block h-5 w-5 align-text-bottom" loading="lazy" />`;
      const placeholder = `\u0000EMOJI${idx++}\u0000`;
      emojis.push({ placeholder, imgTag });
      return placeholder;
    }
  );
  let result = escapeHtml(withPlaceholders);
  for (const { placeholder, imgTag } of emojis) {
    result = result.replace(placeholder, imgTag);
  }
  return sanitizeUserContent(result);
}

/** One timeline row: the icon on the rail, then the date line and the body. */
function Row({ icon: Glyph, children }: { icon: Icon; children: React.ReactNode }) {
  return (
    <li className="group relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
      <span
        aria-hidden
        className="bg-separator absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 group-last:hidden"
      />
      <span
        aria-hidden
        className="bg-surface-secondary border-separator text-label-secondary relative flex size-8 items-center justify-center rounded-full border"
      >
        <Glyph className="size-4" />
      </span>
      <div className="min-w-0 pt-1">{children}</div>
    </li>
  );
}

export function ChronicleRow({ entry }: { entry: ChronicleEntry }) {
  return (
    <Row icon={KIND_ICON[entry.kind]}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-footnote text-label-secondary tabular-nums">{entry.dateLabel}</span>
        <Badge variant={entry.source === "ixtime" ? "secondary" : "default"}>
          {CHRONICLE_KIND_LABEL[entry.kind]}
        </Badge>
      </div>
      <p className="text-headline text-label mt-1">{entry.title}</p>
      {entry.detail && <p className="text-callout text-label-secondary mt-0.5">{entry.detail}</p>}
    </Row>
  );
}

export function ActivityRow({ item }: { item: CountryActivityItem }) {
  const fromForum = item.source === "thinkpages";
  const icon = fromForum || item.type === "post" ? Rss : (TYPE_ICON[item.type] ?? Activity);
  return (
    <Row icon={icon}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-footnote text-label-secondary tabular-nums">
          {isValid(item.timestamp)
            ? formatDistanceToNow(item.timestamp, { addSuffix: true })
            : "recently"}
        </span>
        {fromForum && <Badge variant="outline">ThinkPages</Badge>}
      </div>
      <p
        className="text-headline text-label mt-1"
        dangerouslySetInnerHTML={{ __html: renderWithEmojis(item.title) }}
      />
      {item.description && (
        <p
          className="text-callout text-label-secondary mt-0.5 line-clamp-2"
          dangerouslySetInnerHTML={{ __html: renderWithEmojis(item.description) }}
        />
      )}
      <div className="text-footnote text-label-secondary mt-1.5 flex items-center gap-3 tabular-nums">
        {Object.entries(ENGAGEMENT_ICON).map(([key, EngagementIcon]) => {
          const count = item.engagement?.[key as keyof typeof ENGAGEMENT_ICON] ?? 0;
          return (
            count > 0 && (
              <span key={key} className="flex items-center gap-1">
                <EngagementIcon aria-hidden className="size-3" />
                {count}
              </span>
            )
          );
        })}
      </div>
      {item.source === "activity" && <DiscussedInBadge activityId={item.id} className="mt-1" />}
    </Row>
  );
}
