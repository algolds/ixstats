/** Pieces both link cards draw (satori JSX; see `PassportOgCard.tsx`). */
import type { CSSProperties } from "react";
import { OG_PALETTE as P } from "./og-theme";

/** One line of text, cut with an ellipsis when it overflows. */
export const ONE_LINE: CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/** The Ixnay seal on a faint well, as the passport masthead shows it; nothing when it failed to load. */
export function Seal({ src, size }: { src: string | null; size: number }) {
  if (!src) return null;
  const pad = Math.round(size * 0.1);
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        padding: pad,
        borderRadius: Math.round(size * 0.24),
        background: P.well,
        border: `1.5px solid ${P.rule}`,
      }}
    >
      <img src={src} width={size - pad * 2 - 3} height={size - pad * 2 - 3} alt="" />
    </div>
  );
}
