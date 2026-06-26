"use client";

// ponytail: throwaway logo tweaker. Delete (or harvest the chosen params) once
// a direction is locked. Native inputs only, no deps.

import { useMemo, useState } from "react";

const BLUE = "#0091ff";
const INDIGO = "#4f46e5";

interface Params {
  k: number; // crossings
  R: number; // ring radius
  A: number; // strand amplitude
  width: number; // stroke width
  phase: number; // offset between strands (× π)
  a: string; // strand A color
  b: string; // strand B color
  bg: string; // background / weave casing
  weave: boolean;
}

const DEFAULTS: Params = {
  k: 6,
  R: 31,
  A: 7.5,
  width: 6.5,
  phase: 1,
  a: BLUE,
  b: INDIGO,
  bg: "#ffffff",
  weave: true,
};

function braidPath(phase: number, p: Params) {
  const cx = 50;
  const cy = 50;
  const steps = 220;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const r = p.R + p.A * Math.sin(p.k * t + phase);
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

/** Returns the inner SVG markup (paths only) for live render + export. */
function markBody(p: Params) {
  const A = braidPath(0, p);
  const B = braidPath(p.phase * Math.PI, p);
  const casing = p.weave
    ? `<path d="${A}" stroke="${p.bg}" stroke-width="${p.width + 3.5}" stroke-linecap="round" fill="none"/>`
    : "";
  return [
    `<path d="${B}" stroke="${p.b}" stroke-width="${p.width}" stroke-linecap="round" fill="none"/>`,
    casing,
    `<path d="${A}" stroke="${p.a}" stroke-width="${p.width}" stroke-linecap="round" fill="none"/>`,
  ].join("");
}

function fullSvg(p: Params) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${markBody(
    p,
  )}</svg>`;
}

function Mark({ p, size }: { p: Params; size: number }) {
  const html = useMemo(() => markBody(p), [p]);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-20 text-neutral-600">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="w-12 text-right tabular-nums text-neutral-500">
        {value}
      </span>
    </label>
  );
}

function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-20 text-neutral-600">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-12 cursor-pointer rounded border border-black/10"
      />
      <span className="text-xs text-neutral-400">{value}</span>
    </label>
  );
}

export default function OnomaBrandingTweaker() {
  const [p, setP] = useState<Params>(DEFAULTS);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof Params>(key: K, v: Params[K]) =>
    setP((prev) => ({ ...prev, [key]: v }));

  const copy = () => {
    navigator.clipboard.writeText(fullSvg(p));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-10 p-10 lg:grid-cols-[1fr_320px]">
      {/* Preview */}
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold">Onoma mark tweaker</h1>
          <p className="text-sm text-neutral-500">
            Tune live, then copy the SVG. Throwaway page.
          </p>
        </header>

        <div className="flex flex-wrap items-end gap-8">
          <div
            className="flex items-center justify-center rounded-2xl border border-black/10"
            style={{ background: p.bg, width: 200, height: 200 }}
          >
            <Mark p={p} size={150} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex items-center justify-center rounded-md border border-black/10"
              style={{ background: p.bg, width: 48, height: 48 }}
            >
              <Mark p={p} size={32} />
            </div>
            <span className="text-xs text-neutral-400">32px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex items-center justify-center rounded border border-black/10"
              style={{ background: p.bg, width: 24, height: 24 }}
            >
              <Mark p={p} size={16} />
            </div>
            <span className="text-xs text-neutral-400">16px</span>
          </div>
        </div>

        {/* Wordmark lockup */}
        <div
          className="inline-flex items-center gap-3 rounded-xl px-5 py-3"
          style={{ background: p.bg }}
        >
          <Mark p={p} size={56} />
          <span
            className="text-3xl font-bold tracking-tight"
            style={{ color: p.a }}
          >
            Onoma
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-5">
        <div className="space-y-3 rounded-xl border border-black/10 p-4">
          <h2 className="text-sm font-semibold text-neutral-700">Geometry</h2>
          <Slider label="Crossings" value={p.k} min={3} max={12} step={1} onChange={(v) => set("k", v)} />
          <Slider label="Radius" value={p.R} min={20} max={40} step={1} onChange={(v) => set("R", v)} />
          <Slider label="Amplitude" value={p.A} min={1} max={16} step={0.5} onChange={(v) => set("A", v)} />
          <Slider label="Weight" value={p.width} min={2} max={12} step={0.5} onChange={(v) => set("width", v)} />
          <Slider label="Phase ×π" value={p.phase} min={0} max={2} step={0.05} onChange={(v) => set("phase", v)} />
        </div>

        <div className="space-y-3 rounded-xl border border-black/10 p-4">
          <h2 className="text-sm font-semibold text-neutral-700">Color</h2>
          <Color label="Strand A" value={p.a} onChange={(v) => set("a", v)} />
          <Color label="Strand B" value={p.b} onChange={(v) => set("b", v)} />
          <Color label="Background" value={p.bg} onChange={(v) => set("bg", v)} />
          <label className="flex items-center gap-3 text-sm">
            <span className="w-20 text-neutral-600">Weave</span>
            <input type="checkbox" checked={p.weave} onChange={(e) => set("weave", e.target.checked)} />
          </label>
        </div>

        <div className="space-y-3 rounded-xl border border-black/10 p-4">
          <h2 className="text-sm font-semibold text-neutral-700">Presets</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <button className="rounded border border-black/10 px-2 py-1" onClick={() => setP(DEFAULTS)}>Blue 2-tone</button>
            <button className="rounded border border-black/10 px-2 py-1" onClick={() => setP({ ...DEFAULTS, a: "#0a0a0a", b: "#0a0a0a" })}>Black</button>
            <button className="rounded border border-black/10 px-2 py-1" onClick={() => setP({ ...DEFAULTS, a: "#ffffff", b: "#ffffff", bg: "#0c0e14" })}>White</button>
            <button className="rounded border border-black/10 px-2 py-1" onClick={() => setP({ ...DEFAULTS, a: BLUE, b: BLUE, bg: "#0c0e14" })}>Blue mono</button>
          </div>
        </div>

        <button
          onClick={copy}
          className="w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {copied ? "Copied!" : "Copy SVG"}
        </button>
        <pre className="max-h-32 overflow-auto rounded-lg bg-neutral-50 p-3 text-[10px] leading-tight text-neutral-500">
          {JSON.stringify(p, null, 0)}
        </pre>
      </div>
    </div>
  );
}
