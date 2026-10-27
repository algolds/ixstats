/**
 * The passport link card as satori JSX (rendered by `ImageResponse`, never by React DOM): a paper
 * document over the guilloché, with the seal and "IxStates Passport" masthead, the portrait, name,
 * handle and nation line, and the three facts along the foot like a document's machine strip.
 * Satori lays out with flexbox only: every element with several children sets `display: flex`.
 */
import type { CSSProperties, ReactNode } from "react";
import { guillocheDataUri, type PassportOgModel, type PassportOgStat } from "./og-models";
import { ONE_LINE, Seal } from "./og-parts";
import { OG_FONT_FAMILY, OG_GUILLOCHE_OPACITY, OG_PALETTE as P, OG_SIZE } from "./og-theme";

/** Images fetched by the route, as data URIs; null draws the fallback. */
export interface PassportOgImages {
  seal: string | null;
  avatar: string | null;
  flag: string | null;
}

const INSET = 28;
const PAGE = { width: OG_SIZE.width - INSET * 2, height: OG_SIZE.height - INSET * 2 };
const PORTRAIT = { width: 216, height: 264 };
const GUILLOCHE = guillocheDataUri(PAGE.width, PAGE.height, P.tint, OG_GUILLOCHE_OPACITY.paper);

/** The document page with the guilloché behind `children`. */
function Page({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        padding: INSET,
        background: P.canvas,
        fontFamily: OG_FONT_FAMILY,
        color: P.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          width: PAGE.width,
          height: PAGE.height,
          padding: "44px 56px",
          background: P.paper,
          border: `2px solid ${P.rule}`,
          borderRadius: 28,
          overflow: "hidden",
        }}
      >
        <img
          src={GUILLOCHE}
          width={PAGE.width}
          height={PAGE.height}
          alt=""
          style={{ position: "absolute", top: 0, left: 0 }}
        />
        {children}
      </div>
    </div>
  );
}

function Masthead({ seal }: { seal: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <Seal src={seal} size={60} />
      <div style={{ fontSize: 32, fontWeight: 600 }}>IxStates Passport</div>
    </div>
  );
}

function Portrait({ src, initial }: { src: string | null; initial: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: PORTRAIT.width,
        height: PORTRAIT.height,
        borderRadius: 24,
        border: `3px solid ${P.rule}`,
        background: P.well,
        overflow: "hidden",
      }}
    >
      {src ? (
        <img
          src={src}
          width={PORTRAIT.width}
          height={PORTRAIT.height}
          alt=""
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div style={{ fontSize: 120, fontWeight: 600, color: P.inkSecondary }}>{initial}</div>
      )}
    </div>
  );
}

type Nation = NonNullable<Extract<PassportOgModel, { kind: "passport" }>["nation"]>;

function NationLine({ nation, flag }: { nation: Nation; flag: string | null }) {
  const dot = <div style={{ color: P.inkSecondary }}>·</div>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24, fontSize: 30 }}>
      {flag && (
        <img
          src={flag}
          width={54}
          height={36}
          alt=""
          style={{ objectFit: "cover", borderRadius: 4, border: `1px solid ${P.rule}` }}
        />
      )}
      <div style={{ fontWeight: 600, ...ONE_LINE }}>{nation.name}</div>
      {dot}
      <div style={{ color: P.inkSecondary, ...ONE_LINE }}>{nation.realm}</div>
      {nation.role && dot}
      {nation.role && <div style={{ color: P.inkSecondary }}>{nation.role}</div>}
    </div>
  );
}

function Stat({ stat, first }: { stat: PassportOgStat; first: boolean }) {
  const cell: CSSProperties = {
    display: "flex",
    gap: 10,
    paddingLeft: first ? 0 : 26,
    paddingRight: 26,
    borderLeft: first ? "none" : `2px solid ${P.rule}`,
  };
  if (stat.kind === "lorewards") {
    return (
      <div style={cell}>
        {stat.rank && <div style={{ color: P.tint, fontWeight: 700 }}>{stat.rank}</div>}
        <div>{stat.text}</div>
      </div>
    );
  }
  return <div style={{ ...cell, color: stat.muted ? P.inkSecondary : P.ink }}>{stat.text}</div>;
}

function GenericBody({
  seal,
  title,
  description,
}: {
  seal: string | null;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flex: 1,
        gap: 28,
      }}
    >
      <Seal src={seal} size={112} />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.05 }}>
          {title}
        </div>
        <div style={{ fontSize: 34, color: P.inkSecondary }}>{description}</div>
      </div>
    </div>
  );
}

/** The passport card for `model`, or the generic IxStates Passport card. */
export function PassportOgCard({
  model,
  images,
}: {
  model: PassportOgModel;
  images: PassportOgImages;
}) {
  if (model.kind === "generic") {
    return (
      <Page>
        <GenericBody seal={images.seal} title={model.title} description={model.description} />
      </Page>
    );
  }
  return (
    <Page>
      <Masthead seal={images.seal} />
      <div style={{ display: "flex", alignItems: "center", gap: 52, marginTop: 34, flex: 1 }}>
        <Portrait src={images.avatar} initial={model.initial} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: model.nameSize,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              lineHeight: 1.08,
              ...ONE_LINE,
            }}
          >
            {model.displayName}
          </div>
          <div style={{ fontSize: 32, fontWeight: 500, color: P.inkSecondary, marginTop: 8 }}>
            {model.handle}
          </div>
          {model.nation && <NationLine nation={model.nation} flag={images.flag} />}
        </div>
      </div>
      {model.stats.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 28,
            paddingTop: 22,
            borderTop: `2px solid ${P.rule}`,
            fontSize: 27,
            fontWeight: 500,
          }}
        >
          {model.stats.map((stat, i) => (
            <Stat key={stat.text} stat={stat} first={i === 0} />
          ))}
        </div>
      )}
    </Page>
  );
}
