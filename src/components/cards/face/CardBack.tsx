import { useId } from "react";
import type { CardFinish, LoreCategory } from "@prisma/client";
import { cn } from "~/lib/utils/cn";
import { withBasePath } from "~/lib/base-path";
import { CardsLogomark } from "~/lib/navigation/icons/CardsLogomark";
import { backMotif, type BackMotif } from "~/lib/cards/face/back-motif";
import { CARD_FACE_WIDTH } from "~/lib/cards/face/face-size";
import { FINISH_LABEL, RARITY_LABEL } from "~/lib/cards/face/labels";
import type { TrailEvent } from "~/lib/cards/face/trail";
import type { CardCopyFacts, CardFaceData } from "~/lib/cards/face/types";
import { CopyTrail } from "./CopyTrail";

/** How many moves the back has room for; the sheet's Trail lists them all. */
const TRAIL_ON_BACK = 3;

/** The lattice's tile, in px, at each size: the large back's marks are about 18 px, the small one's 8. */
const TILE = { S: 14, L: 30 } as const;

/** A held copy's story, printed in the middle of its back. */
export interface BackStory {
  facts: CardCopyFacts;
  experience: number;
  inscription: { text: string; signerName: string | null; signedAt: Date | null } | null;
  /** Newest first. */
  trail: TrailEvent[];
}

interface CardBackProps {
  /** The card, with its category; null for a pull not yet seen (the daily card), which gets the plain Cards back. */
  card:
    | (Pick<CardFaceData, "rarity" | "realm" | "season" | "number" | "cardType"> & {
        category: LoreCategory | null;
      })
    | null;
  size: keyof typeof TILE;
  /** The held copy's story; without one the Vault mark sits in the middle. Only the large back prints it. */
  story?: BackStory | null;
  /** The copy's finish when its lattice catches the light (a tilting card, motion allowed); null for a still print. */
  shine?: CardFinish | null;
  className?: string;
}

const longDate = (date: Date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** One mark of the lattice, centred on (x, y) in a box `size` wide. */
function Mark({ motif, x, y, size }: { motif: BackMotif; x: number; y: number; size: number }) {
  const box = { x: x - size / 2, y: y - size / 2, width: size, height: size };
  if (motif.kind === "path") {
    return (
      <svg {...box} viewBox={motif.viewBox}>
        <path d={motif.d} />
      </svg>
    );
  }
  if (motif.kind === "image") {
    const href = motif.href.startsWith("/") ? withBasePath(motif.href) : motif.href;
    return <image {...box} href={href} preserveAspectRatio="xMidYMid meet" />;
  }
  return (
    <text
      x={x}
      y={y}
      dominantBaseline="central"
      textAnchor="middle"
      fontSize={size}
      fontFamily="Georgia, serif"
      fontWeight={600}
    >
      {motif.letter}
    </text>
  );
}

/**
 * The lattice: the motif staggered across the back. The filter turns every mark into a white silhouette, so an emblem
 * or a logo prints like the vector marks, and that mask paints the lattice in `currentColor` (the holo colours for a
 * Holo shine).
 */
interface LatticeProps {
  motif: BackMotif;
  tile: number;
  className: string;
  /** The shine's finish: Holo paints the holo colours, the others their CSS colour (card-art.css). */
  finish?: CardFinish;
}

function Lattice({ motif, tile, className, finish }: LatticeProps) {
  const id = useId();
  const mark = tile * 0.6;
  return (
    <svg
      aria-hidden="true"
      data-card-finish={finish}
      className={cn("absolute inset-0 size-full", className)}
    >
      <defs>
        <pattern id={`${id}p`} width={tile} height={tile * 2} patternUnits="userSpaceOnUse">
          <Mark motif={motif} x={tile / 2} y={tile / 2} size={mark} />
          <Mark motif={motif} x={0} y={tile * 1.5} size={mark} />
          <Mark motif={motif} x={tile} y={tile * 1.5} size={mark} />
        </pattern>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(255 128 214)" />
          <stop offset="0.5" stopColor="rgb(128 222 255)" />
          <stop offset="1" stopColor="rgb(255 236 140)" />
        </linearGradient>
        <filter id={`${id}f`}>
          <feFlood floodColor="white" />
          <feComposite in2="SourceAlpha" operator="in" />
        </filter>
        <mask id={`${id}m`}>
          <rect width="100%" height="100%" fill={`url(#${id}p)`} filter={`url(#${id}f)`} />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={finish === "HOLO" ? `url(#${id}g)` : "currentColor"}
        mask={`url(#${id}m)`}
      />
    </svg>
  );
}

/**
 * The Cards back, printed in the rarity's colour: the card's category mark (else, and always for a trophy, its
 * realm's) in a staggered lattice over a fine engraving, the rarity and season at the top, and at the foot the serial
 * and finish, the Cards mark and wordmark and the card's number. A held copy's story sits in a well in the middle;
 * without one, the Cards mark, its lattice window in the rarity's colour. A Foil, Holo or Serialised copy's lattice
 * catches the light where the pointer is (`shine`).
 */
export function CardBack({ card, size, story = null, shine = null, className }: CardBackProps) {
  // A trophy's back carries its realm's mark: its Special category says nothing a trophy does not.
  const category = card?.cardType === "TROPHY" ? null : (card?.category ?? null);
  const motif = backMotif(category, card?.realm ?? null);
  const large = size === "L";
  const top = card && [card.season ? `Season ${card.season}` : null, RARITY_LABEL[card.rarity]];
  return (
    <div
      data-card-back
      data-card-rarity={card?.rarity ?? "COMMON"}
      className={cn(
        "card-back card-face-edge rounded-card relative isolate aspect-[5/7] max-w-full overflow-hidden",
        CARD_FACE_WIDTH[size],
        className
      )}
    >
      <Lattice motif={motif} tile={TILE[size]} className="card-back-lattice" />
      {shine && shine !== "STANDARD" && (
        <Lattice motif={motif} tile={TILE[size]} className="card-back-shine" finish={shine} />
      )}
      {large ? (
        <div className="relative flex h-full flex-col gap-3 p-4">
          {/* pr-8 clears the turn-over hint in the card's corner. */}
          <p className="text-caption text-label-secondary pr-8">
            {top?.filter(Boolean).join(" · ")}
          </p>
          <div className="grid min-h-0 flex-1 place-items-center">
            {story ? (
              <StoryWell story={story} />
            ) : (
              <CardsLogomark detailed className="text-tint size-1/2" />
            )}
          </div>
          <div className="text-caption text-label-secondary grid grid-cols-[1fr_auto_1fr] items-end gap-2 tabular-nums">
            <span>
              {story && `#${story.facts.serialNumber} · ${FINISH_LABEL[story.facts.finish]}`}
            </span>
            <span className="text-headline text-label flex items-center gap-1 font-semibold tracking-tight">
              <CardsLogomark className="text-tint" />
              Cards
            </span>
            <span className="text-right">{card?.number != null && `No. ${card.number}`}</span>
          </div>
        </div>
      ) : (
        <span className="relative grid h-full place-items-center">
          <CardsLogomark className="text-tint size-1/3" />
        </span>
      )}
    </div>
  );
}

/** The copy's story: its signature, level and XP, and its latest moves. A solid well, so it reads over the lattice. */
function StoryWell({ story }: { story: BackStory }) {
  return (
    <div className="facet-well rounded-row text-footnote text-label max-h-full w-full space-y-2 overflow-y-auto p-3">
      {story.inscription && (
        <figure>
          <blockquote className="text-body">{story.inscription.text}</blockquote>
          <figcaption className="text-label-secondary mt-1">
            Signed by {story.inscription.signerName ?? "a player"}
            {story.inscription.signedAt ? ` on ${longDate(story.inscription.signedAt)}` : ""}
          </figcaption>
        </figure>
      )}
      <p className="tabular-nums">{`Level ${story.facts.level} · ${story.experience.toLocaleString()} XP`}</p>
      {story.trail.length > 0 && <CopyTrail trail={story.trail.slice(0, TRAIL_ON_BACK)} />}
    </div>
  );
}
