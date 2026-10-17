import { cn } from "~/lib/utils/cn";
import { VaultLogomark } from "~/lib/navigation/icons/VaultLogomark";
import type { CardFaceSize } from "~/lib/cards/face/types";
import { CARD_FACE_WIDTH } from "./CardFace";

/** A card waiting to be turned over: the same size as its face, with the Vault mark. Decorative. */
export function CardFaceDown({
  size = "M",
  className,
}: {
  size?: CardFaceSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "card-face-down border-separator rounded-card relative grid aspect-[5/7] shrink-0 place-items-center overflow-hidden border-2",
        CARD_FACE_WIDTH[size],
        className
      )}
    >
      <VaultLogomark className="text-tint size-1/3" />
    </span>
  );
}
