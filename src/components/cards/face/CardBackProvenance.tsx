import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { NationStatesDataCredit } from "~/components/cards/display/NationStatesAttribution";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import { CARD_FACE_WIDTH } from "~/lib/cards/face/face-size";
import type { ArtCredit } from "~/lib/cards/face/art-credit";
import type { NsProvenance } from "~/lib/cards/face/ns-provenance";
import { trailLabel, trailParties, type TrailEvent } from "~/lib/cards/face/trail";
import type { CardFaceData } from "~/lib/cards/face/types";
import { ArtCreditLine } from "./ArtCreditLine";
import { RealmCrest } from "./RealmCrest";

/** How many moves the back lists; the sheet's copy rows have the rest. */
const TRAIL_ON_BACK = 4;

interface CardBackProvenanceProps {
  face: CardFaceData;
  copy: {
    experience: number;
    inscription: { text: string; signerHandle: string | null; signedAt: Date | null } | null;
    /** Newest first. */
    trail: TrailEvent[];
  } | null;
  artCredit: ArtCredit | null;
  ns: NsProvenance | null;
}

const longDate = (date: Date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/**
 * The card back: realm crest, serial and finish, the inscription with the signer's handle, level and XP, the ownership
 * trail by handle, the art credit and licence, and for NS cards the NationStates provenance line. Its edge uses the
 * same rarity colour as the face.
 */
export function CardBackProvenance({ face, copy, artCredit, ns }: CardBackProvenanceProps) {
  return (
    <div
      data-card-rarity={face.rarity}
      className={cn(
        "card-face-edge rounded-card text-footnote text-label flex aspect-[5/7] flex-col gap-3 overflow-y-auto p-4",
        CARD_FACE_WIDTH.L
      )}
    >
      <div className="flex items-center gap-2">
        <RealmCrest realm={face.realm} size="md" />
        <div className="min-w-0">
          <p className="text-headline truncate">{face.realm.name}</p>
          <p className="text-label-secondary tabular-nums">
            {face.copy
              ? `#${face.copy.serialNumber} · ${FINISH_LABEL[face.copy.finish]}`
              : "Not in your collection"}
          </p>
        </div>
      </div>
      {copy?.inscription && (
        <figure className="facet-well rounded-row p-3">
          <blockquote className="text-body">{copy.inscription.text}</blockquote>
          <figcaption className="text-label-secondary mt-1">
            Signed by{" "}
            {copy.inscription.signerHandle ? `@${copy.inscription.signerHandle}` : "a player"}
            {copy.inscription.signedAt ? ` on ${longDate(copy.inscription.signedAt)}` : ""}
          </figcaption>
        </figure>
      )}
      {face.copy && copy && (
        <p className="tabular-nums">{`Level ${face.copy.level} · ${copy.experience.toLocaleString()} XP`}</p>
      )}
      {copy && copy.trail.length > 0 && (
        <ol className="divide-separator divide-y">
          {copy.trail.slice(0, TRAIL_ON_BACK).map((event) => (
            <TrailRow key={event.id} event={event} />
          ))}
        </ol>
      )}
      {ns && <NsLine ns={ns} />}
      {artCredit && <ArtCreditLine credit={artCredit} className="mt-auto" />}
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

function NsLine({ ns }: { ns: NsProvenance }) {
  const facts = [ns.nation, ns.season ? `season ${ns.season}` : null, ns.region, ns.category];
  return (
    <div className="space-y-1">
      <p>{facts.filter(Boolean).join(" · ")}</p>
      <a
        href={ns.cardUrl ?? ns.nationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("text-tint underline", focusRing)}
      >
        View on NationStates
      </a>
      <p className="text-label-secondary">
        <NationStatesDataCredit linkClassName={cn("underline", focusRing)} />
      </p>
    </div>
  );
}
