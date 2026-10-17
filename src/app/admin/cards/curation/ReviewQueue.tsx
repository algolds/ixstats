"use client";
/**
 * The review queue: imported cards wait here until an admin approves them into packs or rejects them. Admins
 * curate the system realms and Ixnay; any realm can be opened.
 */
import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { parseCardArticleSource, type CardWikiSource } from "~/lib/cards/card-sources";
import { MAX_FILTER_REVIEW } from "~/lib/cards/curation-limits";
import { wikiReaderPath } from "~/lib/wiki-os/config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { EmptyState } from "~/components/ui/empty-state";
import { ValueSelect } from "~/components/ui/value-select";
import { useDialogTarget } from "~/hooks/admin/useDialogTarget";
import {
  CARD_TYPES,
  CARD_TYPE_LABELS,
  RARITY_LABELS,
  SOURCE_OPTIONS,
  labelOf,
  type CardTypeValue,
} from "../shared/card-labels";
import { ReasonDialog } from "../shared/ReasonDialog";

type QueueCard = RouterOutputs["cards"]["admin"]["curation"]["queue"]["cards"][number];
type LicenceStatus = NonNullable<QueueCard["artLicence"]>["status"];
type AnySource = CardWikiSource | "any";
type AnyType = CardTypeValue | "any";

const PAGE_SIZE = 100;

const LICENCE: Record<LicenceStatus, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: "Open licence", variant: "success" },
  UNKNOWN: { label: "Licence unknown", variant: "warning" },
  RESTRICTED: { label: "Restricted licence", variant: "destructive" },
};

const SOURCE_FILTER: ReadonlyArray<readonly [AnySource, string]> = [
  ["any", "Any source"],
  ...SOURCE_OPTIONS,
];
const TYPE_FILTER: ReadonlyArray<readonly [AnyType, string]> = [
  ["any", "Any type"],
  ...CARD_TYPES.map((type) => [type, CARD_TYPE_LABELS[type]] as const),
];

const cardCount = (count: number) => `${count.toLocaleString()} ${count === 1 ? "card" : "cards"}`;

function QueueRow({
  card,
  checked,
  onCheckedChange,
}: {
  card: QueueCard;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const article = parseCardArticleSource(card.wikiSource);
  const licence = card.artLicence;
  const badge = licence ? LICENCE[licence.status] : undefined;
  return (
    <li data-row className="flex items-start gap-3 px-3 py-3">
      <Checkbox
        className="mt-1"
        aria-label={card.title}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-callout text-label">{card.title}</span>
          <Badge>{labelOf(RARITY_LABELS, card.rarity)}</Badge>
          <Badge variant="outline">{labelOf(CARD_TYPE_LABELS, card.cardType)}</Badge>
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
        </div>
        <p className="text-footnote text-label-secondary">
          {card.realm.name}
          {licence?.attribution ? ` · ${licence.attribution}` : ""}
        </p>
        {card.wikiExcerpt && (
          <p className="text-footnote text-label-secondary line-clamp-2">{card.wikiExcerpt}</p>
        )}
        <div className="text-footnote flex flex-wrap gap-x-4">
          {article && card.wikiArticleTitle && (
            <Link href={wikiReaderPath(card.wikiArticleTitle, article)} className="text-tint-ink">
              Open the article
            </Link>
          )}
          {licence?.descriptionUrl && (
            <a
              href={licence.descriptionUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-tint-ink"
            >
              Open the art&apos;s file page
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Approve every card the filter shows, after asking. The server approves exactly the cards this queue read showed
 * (its `asOf` and total), and at most MAX_FILTER_REVIEW of them.
 */
function ApproveAll({
  total,
  disabled,
  onConfirm,
}: {
  total: number;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || total === 0 || total > MAX_FILTER_REVIEW}
        >
          Approve all {total.toLocaleString()}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve {cardCount(total)}?</AlertDialogTitle>
          <AlertDialogDescription>
            Every card waiting in this view goes into packs. A card whose art licence is restricted
            stays out.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Approve all</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ReviewQueue() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [realm, setRealm] = useState("admin");
  const [source, setSource] = useState<AnySource>("any");
  const [cardType, setCardType] = useState<AnyType>("any");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const rejecting = useDialogTarget<string[]>();

  const filter = {
    realm,
    ...(source === "any" ? {} : { source }),
    ...(cardType === "any" ? {} : { cardType }),
  };
  const realms = api.cards.admin.overview.realms.useQuery();
  const queue = api.cards.admin.curation.queue.useQuery({ ...filter, limit: PAGE_SIZE });
  const review = api.cards.admin.curation.review.useMutation({
    onSuccess: (result, asked) => {
      notify.success(
        `${cardCount(result.updated)} ${asked.decision === "APPROVE" ? "approved" : "rejected"}`,
        result.skippedRestricted > 0
          ? `${cardCount(result.skippedRestricted)} with a restricted art licence stayed out of packs.`
          : undefined
      );
      setSelected(new Set());
      rejecting.close();
      void utils.cards.admin.curation.queue.invalidate();
      void utils.cards.admin.overview.summary.invalidate();
    },
    onError: (error) => {
      notify.error("Review not saved", error.message);
      // The queue changed under a filter review: read it again, so the next try sees it as it is.
      if (error.data?.code === "CONFLICT") void utils.cards.admin.curation.queue.invalidate();
    },
  });

  const cards = queue.data?.cards ?? [];
  const total = queue.data?.total ?? 0;
  const asOf = queue.data?.asOf;
  /** A filter change clears the choice, so no card the queue no longer shows is reviewed. */
  const refilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setSelected(new Set());
    };
  const toggle = (id: string, checked: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const realmOptions: ReadonlyArray<readonly [string, string]> = [
    ["admin", "Realms admins curate"],
    ["all", "All realms"],
    ...(realms.data ?? []).map((option) => [option.id, option.name] as const),
  ];

  return (
    <Card content="data">
      <CardHeader className="pt-5">
        <CardTitle icon={<CheckCircle />}>Waiting for review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ValueSelect
            aria-label="Realm"
            value={realm}
            onValueChange={refilter(setRealm)}
            options={realmOptions}
          />
          <ValueSelect<AnySource>
            aria-label="Source"
            value={source}
            onValueChange={refilter(setSource)}
            options={SOURCE_FILTER}
          />
          <ValueSelect<AnyType>
            aria-label="Type"
            value={cardType}
            onValueChange={refilter(setCardType)}
            options={TYPE_FILTER}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-footnote text-label-secondary tabular-nums">
            {total.toLocaleString()} waiting
          </span>
          <Button
            size="sm"
            disabled={selected.size === 0 || review.isPending}
            onClick={() => review.mutate({ decision: "APPROVE", cardIds: [...selected] })}
          >
            Approve {selected.size}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selected.size === 0}
            onClick={() => rejecting.open([...selected])}
          >
            Reject {selected.size}
          </Button>
          <ApproveAll
            total={total}
            disabled={review.isPending || !asOf}
            onConfirm={() =>
              asOf && review.mutate({ decision: "APPROVE", filter, asOf, expected: total })
            }
          />
        </div>
        {total > MAX_FILTER_REVIEW && (
          <p className="text-footnote text-label-secondary">
            Narrow the filter to approve all: at most {MAX_FILTER_REVIEW.toLocaleString()} cards at
            once.
          </p>
        )}

        {queue.isError ? (
          <p role="alert" className="text-destructive text-footnote">
            The review queue did not load. {queue.error.message}
          </p>
        ) : cards.length === 0 ? (
          <EmptyState
            compact
            title="Nothing waiting"
            message="Imported cards appear here before they reach packs."
          />
        ) : (
          <ul className="border-separator rounded-row divide-separator divide-y border">
            {cards.map((card) => (
              <QueueRow
                key={card.id}
                card={card}
                checked={selected.has(card.id)}
                onCheckedChange={(checked) => toggle(card.id, checked)}
              />
            ))}
          </ul>
        )}
        {total > cards.length && cards.length > 0 && (
          <p className="text-footnote text-label-secondary">
            Showing the first {cards.length.toLocaleString()}. Review these to see the rest.
          </p>
        )}
      </CardContent>
      <ReasonDialog
        open={rejecting.target !== null}
        onOpenChange={(open) => !open && rejecting.close()}
        title={`Reject ${cardCount(rejecting.shown?.length ?? 0)}`}
        description="They stay out of packs."
        confirmLabel="Reject"
        destructive
        pending={review.isPending}
        onConfirm={(note) =>
          rejecting.target && review.mutate({ decision: "REJECT", cardIds: rejecting.target, note })
        }
      />
    </Card>
  );
}
