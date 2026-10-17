"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { cardFaceLabel } from "~/lib/cards/face/accessible-name";
import { CARD_FACE_WIDTH } from "~/lib/cards/face/face-size";
import type { CardFaceData, CardFaceSize } from "~/lib/cards/face/types";
import { RealmCrest } from "./RealmCrest";

const TITLE_TEXT: Record<CardFaceSize, string> = {
  S: "text-caption",
  M: "text-subhead",
  L: "text-title-3",
};
const GEM_SIZE: Record<CardFaceSize, string> = { S: "size-3", M: "size-3", L: "size-4" };
const PRESSABLE = cn("facet-press cursor-pointer", focusRing);

interface FaceBaseProps {
  face: CardFaceData;
  size?: CardFaceSize;
  className?: string;
}

/** A button that opens the card (its sheet). */
interface ButtonFaceProps extends FaceBaseProps {
  onOpen: (face: CardFaceData) => void;
  /** Select mode: whether this face is picked (the caller's `onOpen` toggles it). */
  selected?: boolean;
  href?: never;
}

/** A link that opens the card on another page. */
interface LinkFaceProps extends FaceBaseProps {
  href: string;
  onOpen?: never;
  selected?: never;
}

/** A picture with the same name, when the face opens nothing. */
interface PictureFaceProps extends FaceBaseProps {
  onOpen?: never;
  href?: never;
  selected?: never;
}

type CardFaceProps = ButtonFaceProps | LinkFaceProps | PictureFaceProps;

/**
 * The one card face: full-bleed art, title and realm crest at the bottom, rarity as edge and gem, finish as sheen, a
 * season chip for NS and Nation cards, and level and serial at size L. Nothing else goes on the front.
 * `data-card-face` and `data-card-finish` sit on the root because card-art.css finds the sheen through them.
 */
export function CardFace({ face, size = "M", onOpen, href, selected, className }: CardFaceProps) {
  const frame = {
    "aria-label": cardFaceLabel(face),
    "data-card-face": "",
    "data-card-rarity": face.rarity,
    "data-card-finish": face.copy?.finish ?? "STANDARD",
  };
  const shape = cn(
    "card-face-edge rounded-card relative block aspect-[5/7] shrink-0 overflow-hidden text-left",
    CARD_FACE_WIDTH[size],
    className
  );
  const body = <FaceBody face={face} size={size} selected={selected === true} />;

  if (href) {
    return (
      <Link href={href} {...frame} className={cn(shape, PRESSABLE)}>
        {body}
      </Link>
    );
  }
  if (onOpen) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onOpen(face)}
        {...frame}
        className={cn(shape, PRESSABLE)}
      >
        {body}
      </button>
    );
  }
  return (
    <div role="img" {...frame} className={shape}>
      {body}
    </div>
  );
}

function FaceBody({
  face,
  size,
  selected,
}: {
  face: CardFaceData;
  size: CardFaceSize;
  selected: boolean;
}) {
  // The URL that failed, not a flag, so a face handed new art tries it.
  const [failedArt, setFailedArt] = useState<string | null>(null);
  const art = face.artwork && face.artwork !== failedArt ? proxyCardArtwork(face.artwork) : null;
  return (
    <span aria-hidden="true" className="absolute inset-0 block">
      {art ? (
        <img
          src={art}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedArt(face.artwork)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="card-face-tint absolute inset-0 grid place-items-center">
          <RealmCrest
            realm={face.realm}
            size={size === "S" ? "md" : "lg"}
            muted={face.silhouette}
          />
        </span>
      )}
      <span className="card-face-sheen absolute inset-0" />
      {face.season !== null && (
        <span className="text-caption absolute top-2 left-2 rounded-full bg-black/60 px-2 text-white tabular-nums">
          S{face.season}
        </span>
      )}
      {selected && (
        <span className="bg-tint text-on-tint absolute top-2 right-2 grid size-6 place-items-center rounded-full">
          <Check className="size-4" />
        </span>
      )}
      <span className="card-face-scrim absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2 pt-10 text-white">
        <span className="flex items-end gap-1">
          <RealmCrest realm={face.realm} size="sm" muted={face.silhouette} />
          <span className={cn("line-clamp-2 min-w-0 flex-1 font-semibold", TITLE_TEXT[size])}>
            {face.title}
          </span>
          <span className={cn("card-face-gem mb-1 shrink-0", GEM_SIZE[size])} />
        </span>
        <FaceFootnote face={face} size={size} />
      </span>
    </span>
  );
}

/** Under the title: a silhouette's number, a retired card's note, and at size L the copy's level and serial. */
function FaceFootnote({ face, size }: { face: CardFaceData; size: CardFaceSize }) {
  const notes: string[] = [];
  if (face.silhouette && face.number !== null) notes.push(`No. ${face.number}`);
  if (face.isRetired) notes.push("Retired");
  if (size === "L" && face.copy) {
    notes.push(`Level ${face.copy.level} · #${face.copy.serialNumber}`);
  }
  if (notes.length === 0) return null;
  return <span className="text-caption text-white/80 tabular-nums">{notes.join(" · ")}</span>;
}
