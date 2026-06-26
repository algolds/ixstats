"use client";

// ponytail: throwaway logo-exploration page. Delete once a direction is picked.
// Two concepts × three color treatments, shown large + at favicon size.

const BLUE = "#0091ff";
const INDIGO = "#4f46e5";

// ---- Concept 1: O-helix monogram (double helix bent into a closed loop) ----
// Two strands oscillate in radius around a circle; they cross where sin()=0,
// giving a braided "O". Computed once, no animation.
function braidPath(phase: number) {
  const cx = 50;
  const cy = 50;
  const R = 31;
  const A = 7.5;
  const k = 6; // number of crossings
  const steps = 160;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const r = R + A * Math.sin(k * t + phase);
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

const STRAND_A = braidPath(0);
const STRAND_B = braidPath(Math.PI);

function OHelixMark({
  a,
  b,
  width = 6.5,
}: {
  a: string;
  b: string;
  width?: number;
}) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" fill="none">
      <path d={STRAND_B} stroke={b} strokeWidth={width} strokeLinecap="round" />
      <path d={STRAND_A} stroke={a} strokeWidth={width} strokeLinecap="round" />
    </svg>
  );
}

// ---- Concept 2: Twin glyph tiles (source script ⟷ generated name) ----
function TwinTileMark({
  back,
  front,
  glyph = "#ffffff",
  border,
}: {
  back: string;
  front: string;
  glyph?: string;
  border?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {/* back tile: source script */}
      <g>
        <rect x="12" y="16" width="46" height="46" rx="14" fill={back} />
        <text
          x="35"
          y="46"
          textAnchor="middle"
          fontSize="26"
          fontWeight={800}
          fill={glyph}
          fontFamily="ui-sans-serif, system-ui"
        >
          文
        </text>
      </g>
      {/* front tile: generated name (Onoma O) */}
      <g>
        <rect
          x="42"
          y="38"
          width="46"
          height="46"
          rx="14"
          fill={front}
          stroke={border ?? "none"}
          strokeWidth={border ? 2.5 : 0}
        />
        <text
          x="65"
          y="69"
          textAnchor="middle"
          fontSize="27"
          fontWeight={800}
          fill={glyph}
          fontFamily="ui-sans-serif, system-ui"
        >
          O
        </text>
      </g>
    </svg>
  );
}

function Cell({
  label,
  bg,
  children,
}: {
  label: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex items-center justify-center rounded-2xl border border-black/10"
        style={{ background: bg, width: 160, height: 160 }}
      >
        <div className="h-28 w-28">{children}</div>
      </div>
      {/* favicon-size proof */}
      <div
        className="flex items-center justify-center rounded-md border border-black/10"
        style={{ background: bg, width: 40, height: 40 }}
      >
        <div className="h-4 w-4">{children}</div>
      </div>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}

export default function OnomaBrandingPreview() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 p-10">
      <header>
        <h1 className="text-2xl font-bold">Onoma mark exploration</h1>
        <p className="text-sm text-neutral-500">
          Each mark shown large + at 16px (favicon proof). Throwaway page.
        </p>
      </header>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">
          Concept 1 — O-helix monogram
        </h2>
        <div className="flex flex-wrap gap-8">
          <Cell label="Black" bg="#ffffff">
            <OHelixMark a="#0a0a0a" b="#0a0a0a" />
          </Cell>
          <Cell label="White" bg="#0c0e14">
            <OHelixMark a="#ffffff" b="#ffffff" />
          </Cell>
          <Cell label="Onoma blue (two-tone)" bg="#ffffff">
            <OHelixMark a={BLUE} b={INDIGO} />
          </Cell>
          <Cell label="Onoma blue (mono)" bg="#0c0e14">
            <OHelixMark a={BLUE} b={BLUE} />
          </Cell>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Concept 2 — Twin glyph tiles</h2>
        <div className="flex flex-wrap gap-8">
          <Cell label="Black" bg="#ffffff">
            <TwinTileMark back="#3a3a3a" front="#0a0a0a" glyph="#ffffff" />
          </Cell>
          <Cell label="White" bg="#0c0e14">
            <TwinTileMark
              back="transparent"
              front="transparent"
              glyph="#ffffff"
              border="#ffffff"
            />
          </Cell>
          <Cell label="Onoma blue (two-tone)" bg="#ffffff">
            <TwinTileMark back={INDIGO} front={BLUE} glyph="#ffffff" />
          </Cell>
          <Cell label="Onoma blue (mono)" bg="#0c0e14">
            <TwinTileMark back="#0a4f8c" front={BLUE} glyph="#ffffff" />
          </Cell>
        </div>
      </section>
    </div>
  );
}
