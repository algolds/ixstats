/**
 * The realm link card as satori JSX (rendered by `ImageResponse`): the realm's banner (or the tint
 * with the guilloché in paper white when it has none), then on paper the IxStates seal, the realm's
 * name and counts, and the "Join on IxStates" pill. Draft and unknown realms get the generic card.
 */
import { guillocheDataUri, type RealmOgModel } from "./og-models";
import { ONE_LINE, Seal } from "./og-parts";
import { OG_FONT_FAMILY, OG_GUILLOCHE_OPACITY, OG_PALETTE as P, OG_SIZE } from "./og-theme";

/** Images fetched by the route, as data URIs; null draws the fallback. */
export interface RealmOgImages {
  seal: string | null;
  banner: string | null;
}

const BANNER = { width: OG_SIZE.width, height: 300 };
const BANNER_GUILLOCHE = guillocheDataUri(
  BANNER.width,
  BANNER.height,
  P.paper,
  OG_GUILLOCHE_OPACITY.banner
);

function Banner({ src }: { src: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        width: BANNER.width,
        height: BANNER.height,
        background: P.tint,
        borderBottom: `2px solid ${P.rule}`,
        overflow: "hidden",
      }}
    >
      <img
        src={src ?? BANNER_GUILLOCHE}
        width={BANNER.width}
        height={BANNER.height}
        alt=""
        style={{ objectFit: "cover" }}
      />
    </div>
  );
}

/** The realm card for `model` (also the generic Realms card). */
export function RealmOgCard({ model, images }: { model: RealmOgModel; images: RealmOgImages }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        background: P.paper,
        fontFamily: OG_FONT_FAMILY,
        color: P.ink,
      }}
    >
      <Banner src={images.banner} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 40,
          flex: 1,
          padding: "0 56px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Seal src={images.seal} size={44} />
            <div style={{ fontSize: 26, fontWeight: 600, color: P.inkSecondary }}>IxStates</div>
          </div>
          <div
            style={{
              fontSize: model.nameSize,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              lineHeight: 1.08,
              marginTop: 18,
              ...ONE_LINE,
            }}
          >
            {model.name}
          </div>
          {model.counts && (
            <div style={{ fontSize: 30, color: P.inkSecondary, marginTop: 8 }}>{model.counts}</div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            padding: "16px 30px",
            borderRadius: 999,
            background: P.tint,
            color: P.onTint,
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          {model.cta}
        </div>
      </div>
    </div>
  );
}
