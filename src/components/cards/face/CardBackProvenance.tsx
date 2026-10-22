import { cn } from "~/lib/utils/cn";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import { CARD_FACE_WIDTH } from "~/lib/cards/face/face-size";
import { trailLabel, trailParties, type TrailEvent } from "~/lib/cards/face/trail";
import type { CardCopyFacts, CardFaceData } from "~/lib/cards/face/types";
import { RealmCrest } from "./RealmCrest";

/** How many moves the back has room for. */
const TRAIL_ON_BACK = 4;

interface CardBackProvenanceProps {
  face: CardFaceData;
  /** The copy's serial, finish and level. */
  facts: CardCopyFacts;
  copy: {
    experience: number;
    inscription: { text: string; signerName: string | null; signedAt: Date | null } | null;
    /** Newest first. */
    trail: TrailEvent[];
  };
}

const longDate = (date: Date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/**
 * The card back, one held copy's story: realm crest, serial and finish, the inscription with the signer's name and
 * date, level and XP, and the ownership trail by name. Its edge uses the same rarity colour as the face.
 */
export function CardBackProvenance({ face, facts, copy }: CardBackProvenanceProps) {
  return (
    <div
      data-card-rarity={face.rarity}
      className={cn(
        "card-face-edge rounded-card text-footnote text-label flex aspect-[5/7] max-w-full flex-col gap-3 overflow-y-auto p-4",
        CARD_FACE_WIDTH.L
      )}
    >
      {/* pr-6 clears the turn-over hint in the card's corner. */}
      <div className="flex items-center gap-2 pr-6">
        <RealmCrest realm={face.realm} size="md" />
        <div className="min-w-0">
          <p className="text-headline truncate">{face.realm.name}</p>
          <p className="text-label-secondary tabular-nums">
            {`#${facts.serialNumber} · ${FINISH_LABEL[facts.finish]}`}
          </p>
        </div>
      </div>
      {copy.inscription && (
        <figure className="facet-well rounded-row p-3">
          <blockquote className="text-body">{copy.inscription.text}</blockquote>
          <figcaption className="text-label-secondary mt-1">
            Signed by {copy.inscription.signerName ?? "a player"}
            {copy.inscription.signedAt ? ` on ${longDate(copy.inscription.signedAt)}` : ""}
          </figcaption>
        </figure>
      )}
      <p className="tabular-nums">{`Level ${facts.level} · ${copy.experience.toLocaleString()} XP`}</p>
      {copy.trail.length > 0 && (
        <ol className="divide-separator divide-y">
          {copy.trail.slice(0, TRAIL_ON_BACK).map((event) => (
            <TrailRow key={event.id} event={event} />
          ))}
        </ol>
      )}
    </div>
  );
}

function TrailRow({ event }: { event: TrailEvent }) {
  const parties = trailParties(event);
  return (
    <li className="flex items-baseline justify-between gap-2 py-1">
      <span className="min-w-0">
        <span className="block">{trailLabel(event.action)}</span>
        {parties && <span className="text-label-secondary block">{parties}</span>}
      </span>
      <time className="text-label-secondary shrink-0" dateTime={event.at.toISOString()}>
        {event.at.toLocaleDateString()}
      </time>
    </li>
  );
}
