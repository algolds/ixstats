"use client";

// Onoma Lab — Logo Branding Assets Tweaker (Phase 7).
// Merges the DNA helix/braid with linguistic symbols.
// Includes 8 distinct styling variations (plasmid variations, traditional linear DNA, language tree, and soundwave helix).
// Aligns fully with the Facet Design System.

import { useMemo, useState, useEffect } from "react";
import { Sparkles, BookOpen } from "lucide-react";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { applyFlanking, getGoogleFontLink, GOOGLE_FONTS } from "~/lib/onoma/branding-utils";

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
  variation: string; // clean | nucleus | crossings | orbit | flanking | linear-dna | language-tree | acoustic-wave
  nucleusSymbol: string; // e.g. "ə", "Ω"
  fontSize: number; // size multiplier for symbols
  orbitOffset: number; // distance of outer orbit
  flankingStyle: string; // brackets | slashes | ipa | none
  fontFamily: string;
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
  variation: "language-tree",
  nucleusSymbol: "ə",
  fontSize: 22,
  orbitOffset: 12,
  flankingStyle: "brackets",
  fontFamily: "Inter",
};

// --------------------------------------------------------------------------------
// Mathematical Path Generators
// --------------------------------------------------------------------------------

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

function linearHelixPath(phase: number, p: Params) {
  const cx = 50;
  const pts: string[] = [];
  const steps = 100;
  const startY = 15;
  const endY = 85;
  const amplitude = p.A * 1.6;
  const freq = (p.k * Math.PI) / (endY - startY);

  for (let i = 0; i <= steps; i++) {
    const y = startY + (i / steps) * (endY - startY);
    const x = cx + amplitude * Math.sin(freq * (y - startY) + phase);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M ${pts.join(" L ")}`;
}

// --------------------------------------------------------------------------------
// Markup Builders
// --------------------------------------------------------------------------------

function getNucleusMarkup(p: Params, symbol: string, fontSize: number, color: string) {
  const safeSymbol = symbol.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<text x="50" y="53" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="600" fill="${color}" text-anchor="middle" dominant-baseline="middle">${safeSymbol}</text>`;
}

function getOrbitMarkup(
  p: Params,
  symbols: string[],
  offset: number,
  fontSize: number,
  color: string
) {
  const cx = 50;
  const cy = 50;
  const r = p.R + p.A + offset;

  const orbitPath = `<circle cx="50" cy="50" r="${r}" stroke="${color}" stroke-opacity="0.18" stroke-width="0.75" stroke-dasharray="2,3" fill="none" />`;

  const textElements = symbols
    .map((sym, index) => {
      const angle = (index / symbols.length) * 2 * Math.PI - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);

      const nodeBg = `<circle cx="${x}" cy="${y}" r="${fontSize * 0.85}" fill="${p.bg}" stroke="${color}" stroke-opacity="0.3" stroke-width="0.5" />`;
      const safeSym = sym.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const nodeText = `<text x="${x}" y="${y + 0.5}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="500" fill="${color}" fill-opacity="0.9" text-anchor="middle" dominant-baseline="middle">${safeSym}</text>`;
      return `${nodeBg}${nodeText}`;
    })
    .join("");

  return `${orbitPath}${textElements}`;
}

function getCrossingsMarkup(p: Params, symbols: string[], fontSize: number, color: string) {
  const cx = 50;
  const cy = 50;
  const crossingsCount = p.k * 2;

  const textElements = [];
  for (let i = 0; i < crossingsCount; i++) {
    const sym = symbols[i % symbols.length];
    const angle = (i / crossingsCount) * 2 * Math.PI - Math.PI / 2;
    const x = cx + p.R * Math.cos(angle);
    const y = cy + p.R * Math.sin(angle);

    const nodeBg = `<circle cx="${x}" cy="${y}" r="${fontSize * 0.85}" fill="${p.bg}" stroke="${color}" stroke-opacity="0.4" stroke-width="0.75" />`;
    const safeSym = sym.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const nodeText = `<text x="${x}" y="${y + 0.5}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="600" fill="${color}" text-anchor="middle" dominant-baseline="middle">${safeSym}</text>`;
    textElements.push(`${nodeBg}${nodeText}`);
  }
  return textElements.join("");
}

function getLinearRungs(p: Params, color: string) {
  const startY = 15;
  const endY = 85;
  const steps = 7;
  const cx = 50;
  const amplitude = p.A * 1.6;
  const freq = (p.k * Math.PI) / (endY - startY);

  const rungs: string[] = [];
  for (let i = 1; i < steps; i++) {
    const y = startY + (i / steps) * (endY - startY);
    const x1 = cx + amplitude * Math.sin(freq * (y - startY));
    const x2 = cx - amplitude * Math.sin(freq * (y - startY));

    // Rung line
    rungs.push(
      `<line x1="${x1.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${color}" stroke-opacity="0.22" stroke-width="1.5" />`
    );
    // Outer strand nodes
    rungs.push(`<circle cx="${x1.toFixed(2)}" cy="${y.toFixed(2)}" r="2" fill="${p.a}" />`);
    rungs.push(`<circle cx="${x2.toFixed(2)}" cy="${y.toFixed(2)}" r="2" fill="${p.b}" />`);
  }
  return rungs.join("");
}

function getTreeMarkup(p: Params) {
  const trunk = `<path d="M 50,85 L 50,65" stroke="${p.a}" stroke-width="${p.width * 0.8}" stroke-linecap="round" fill="none" />`;
  const leftBranch1 = `<path d="M 50,65 L 30,45" stroke="${p.a}" stroke-width="${p.width * 0.6}" stroke-linecap="round" fill="none" />`;
  const rightBranch1 = `<path d="M 50,65 L 70,45" stroke="${p.b}" stroke-width="${p.width * 0.6}" stroke-linecap="round" fill="none" />`;
  const leftBranch2a = `<path d="M 30,45 L 18,25" stroke="${p.a}" stroke-width="${p.width * 0.4}" stroke-linecap="round" fill="none" />`;
  const leftBranch2b = `<path d="M 30,45 L 42,25" stroke="${p.a}" stroke-width="${p.width * 0.4}" stroke-linecap="round" fill="none" />`;
  const rightBranch2a = `<path d="M 70,45 L 58,25" stroke="${p.b}" stroke-width="${p.width * 0.4}" stroke-linecap="round" fill="none" />`;
  const rightBranch2b = `<path d="M 70,45 L 82,25" stroke="${p.b}" stroke-width="${p.width * 0.4}" stroke-linecap="round" fill="none" />`;

  const branches = [
    trunk,
    leftBranch1,
    rightBranch1,
    leftBranch2a,
    leftBranch2b,
    rightBranch2a,
    rightBranch2b,
  ].join("");

  const labelStyle = `font-family="system-ui, -apple-system, sans-serif" font-size="3.2" font-weight="850" text-anchor="middle" dominant-baseline="middle"`;

  const annotations = [
    `<text x="36" y="52" fill="${p.a}" ${labelStyle} fill-opacity="0.9">*p &gt; f</text>`,
    `<text x="64" y="52" fill="${p.b}" ${labelStyle} fill-opacity="0.9">*k &gt; x</text>`,
    `<text x="21" y="32" fill="${p.a}" ${labelStyle} fill-opacity="0.9">*t &gt; θ</text>`,
    `<text x="39" y="32" fill="${p.a}" ${labelStyle} fill-opacity="0.9">*s &gt; h</text>`,
    `<text x="61" y="32" fill="${p.b}" ${labelStyle} fill-opacity="0.9">*d &gt; t</text>`,
    `<text x="79" y="32" fill="${p.b}" ${labelStyle} fill-opacity="0.9">*g &gt; k</text>`,
  ].join("");

  const leaves = [
    { x: 18, y: 25, char: p.nucleusSymbol || "ə", col: p.a },
    { x: 42, y: 25, char: p.nucleusSymbol === "ə" ? "ʃ" : "ə", col: p.a },
    { x: 58, y: 25, char: "ð", col: p.b },
    { x: 82, y: 25, char: "θ", col: p.b },
    { x: 50, y: 65, char: "Ω", col: p.a },
  ];

  const nodes = leaves
    .map((lf) => {
      const bg = `<circle cx="${lf.x}" cy="${lf.y}" r="6" fill="${p.bg}" stroke="${lf.col}" stroke-width="1.25" />`;
      const text = `<text x="${lf.x}" y="${lf.y + 0.6}" font-family="system-ui, -apple-system, sans-serif" font-size="7.2" font-weight="800" fill="${lf.col}" text-anchor="middle" dominant-baseline="middle">${lf.char}</text>`;
      return `${bg}${text}`;
    })
    .join("");

  return `${branches}${annotations}${nodes}`;
}

function getSoundwaveHelixMarkup(p: Params) {
  const startX = 15;
  const endX = 85;
  const cy = 50;
  const amplitude = p.A * 1.3;
  const freq = (p.k * Math.PI) / (endX - startX);

  const bars: string[] = [];
  const barsCount = 24;
  for (let i = 0; i <= barsCount; i++) {
    const x = startX + (i / barsCount) * (endX - startX);
    const norm = i / barsCount;
    const env = Math.sin(norm * Math.PI) * (Math.sin(norm * 4 * Math.PI) * 0.35 + 0.65);
    const h = 3 + env * 22;

    bars.push(
      `<line x1="${x.toFixed(2)}" y1="${(cy - h).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(cy + h).toFixed(2)}" stroke="${p.b}" stroke-opacity="0.16" stroke-width="1.75" stroke-linecap="round" />`
    );
  }

  const ptsA: string[] = [];
  const ptsB: string[] = [];
  const steps = 100;
  for (let i = 0; i <= steps; i++) {
    const x = startX + (i / steps) * (endX - startX);
    const y1 = cy + amplitude * Math.sin(freq * (x - startX));
    const y2 = cy - amplitude * Math.sin(freq * (x - startX));
    ptsA.push(`${x.toFixed(2)},${y1.toFixed(2)}`);
    ptsB.push(`${x.toFixed(2)},${y2.toFixed(2)}`);
  }

  const strandA = `<path d="M ${ptsA.join(" L ")}" stroke="${p.a}" stroke-width="${p.width * 0.8}" stroke-linecap="round" fill="none" />`;
  const strandB = `<path d="M ${ptsB.join(" L ")}" stroke="${p.b}" stroke-width="${p.width * 0.8}" stroke-linecap="round" fill="none" />`;

  const rungs: string[] = [];
  const rungCount = 6;
  for (let i = 1; i < rungCount; i++) {
    const x = startX + (i / rungCount) * (endX - startX);
    const y1 = cy + amplitude * Math.sin(freq * (x - startX));
    const y2 = cy - amplitude * Math.sin(freq * (x - startX));
    rungs.push(
      `<line x1="${x.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${p.a}" stroke-opacity="0.22" stroke-width="1" />`
    );
  }

  return `${bars.join("")}${rungs.join("")}${strandA}${strandB}`;
}

function markBody(p: Params) {
  if (p.variation === "linear-dna") {
    const A = linearHelixPath(0, p);
    const B = linearHelixPath(p.phase * Math.PI, p);
    const casing = p.weave
      ? `<path d="${A}" stroke="${p.bg}" stroke-width="${p.width + 3.5}" stroke-linecap="round" fill="none"/>`
      : "";
    return [
      `<path d="${B}" stroke="${p.b}" stroke-width="${p.width}" stroke-linecap="round" fill="none"/>`,
      casing,
      `<path d="${A}" stroke="${p.a}" stroke-width="${p.width}" stroke-linecap="round" fill="none"/>`,
      getLinearRungs(p, p.a),
    ].join("");
  }

  if (p.variation === "language-tree") {
    return getTreeMarkup(p);
  }

  if (p.variation === "acoustic-wave") {
    return getSoundwaveHelixMarkup(p);
  }

  // Baseline Plasmid Variation
  const A = braidPath(0, p);
  const B = braidPath(p.phase * Math.PI, p);
  const casing = p.weave
    ? `<path d="${A}" stroke="${p.bg}" stroke-width="${p.width + 3.5}" stroke-linecap="round" fill="none"/>`
    : "";

  let baseMarkup = [
    `<path d="${B}" stroke="${p.b}" stroke-width="${p.width}" stroke-linecap="round" fill="none"/>`,
    casing,
    `<path d="${A}" stroke="${p.a}" stroke-width="${p.width}" stroke-linecap="round" fill="none"/>`,
  ].join("");

  if (p.variation === "nucleus" || p.variation === "flanking") {
    baseMarkup += getNucleusMarkup(p, p.nucleusSymbol || "ə", p.fontSize, p.a);
  } else if (p.variation === "orbit") {
    const orbitSymbols = ["A", "Ω", "あ", "ش", "ə", "𐦫"];
    baseMarkup += getOrbitMarkup(p, orbitSymbols, p.orbitOffset, p.fontSize * 0.35, p.a);
  } else if (p.variation === "crossings") {
    const crossingSymbols = ["ə", "ʃ", "θ", "ʌ", "æ", "ð"];
    baseMarkup += getCrossingsMarkup(p, crossingSymbols, p.fontSize * 0.35, p.a);
  }

  return baseMarkup;
}

function fullSvg(p: Params) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${markBody(p)}</svg>`;
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
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-[11px] font-semibold">{label}</Label>
        <span className="text-muted-foreground font-mono text-[10px]">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="bg-secondary h-1 w-full cursor-pointer rounded-lg accent-[#0091ff]"
      />
    </div>
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
    <div className="flex items-center justify-between gap-3">
      <Label className="text-muted-foreground text-[11px] font-semibold">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-border/40 h-6 w-10 cursor-pointer rounded border bg-transparent"
        />
        <span className="text-muted-foreground font-mono text-[10px]">{value}</span>
      </div>
    </div>
  );
}

export default function OnomaBrandingTweaker() {
  const [p, setP] = useState<Params>(DEFAULTS);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof Params>(key: K, v: Params[K]) =>
    setP((prev) => ({ ...prev, [key]: v }));

  const notify = useNotify();
  const utils = api.useUtils();
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery();

  useEffect(() => {
    if (speechConfig?.brand) {
      setP((prev) => ({
        ...prev,
        variation: speechConfig.brand.variation || "language-tree",
        nucleusSymbol: speechConfig.brand.nucleusSymbol || "ə",
        flankingStyle: speechConfig.brand.flankingStyle || "brackets",
        fontFamily: speechConfig.brand.fontFamily || "Inter",
      }));
    }
  }, [speechConfig]);

  const saveBrand = api.onoma.updateBrandConfig.useMutation({
    onSuccess: async () => {
      await utils.onoma.getSpeechConfig.invalidate();
      notify.success("Branding configuration updated globally.");
    },
    onError: (err) => {
      notify.error(`Failed to save brand config: ${err.message}`);
    },
  });

  const copy = () => {
    navigator.clipboard.writeText(fullSvg(p));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const wordmarkText = useMemo(() => {
    return applyFlanking("Onoma", p.flankingStyle);
  }, [p.flankingStyle]);

  const fontLink = getGoogleFontLink(p.fontFamily);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 p-10 text-left lg:grid-cols-[1fr_360px]">
      {fontLink && <link rel="stylesheet" href={fontLink} />}
      {/* Preview Section */}
      <div className="space-y-8">
        <header className="border-border/40 border-b pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#0091ff]" />
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              Onoma Branding Lab
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Visual identity workbench. Weaving biological generation (DNA helix) with human
            phonetics.
          </p>
        </header>

        {/* Live Logo Previews */}
        <div className="space-y-6">
          <h3 className="text-muted-foreground/60 text-xs font-bold tracking-wider uppercase">
            Logo Mark Scales
          </h3>
          <div className="flex flex-wrap items-end gap-10">
            {/* Primary Large Display */}
            <div className="flex flex-col gap-2">
              <FacetContainer
                depth={1}
                className="border-border/40 flex items-center justify-center rounded-2xl border"
                style={{ background: p.bg, width: 220, height: 220 }}
              >
                <Mark p={p} size={170} />
              </FacetContainer>
              <span className="text-muted-foreground text-center font-mono text-[10px]">
                220px Display
              </span>
            </div>

            {/* Application Launcher / Avatar Scale */}
            <div className="flex flex-col items-center gap-2">
              <FacetContainer
                depth={1}
                className="border-border/40 flex items-center justify-center rounded-xl border"
                style={{ background: p.bg, width: 64, height: 64 }}
              >
                <Mark p={p} size={48} />
              </FacetContainer>
              <span className="text-muted-foreground font-mono text-[10px]">
                64px (App Launcher)
              </span>
            </div>

            {/* Favicon / Small Icon Scale */}
            <div className="flex flex-col items-center gap-2">
              <FacetContainer
                depth={1}
                className="border-border/40 flex items-center justify-center rounded border"
                style={{ background: p.bg, width: 32, height: 32 }}
              >
                <Mark p={p} size={22} />
              </FacetContainer>
              <span className="text-muted-foreground font-mono text-[10px]">32px (Favicon)</span>
            </div>
          </div>
        </div>

        {/* Wordmark lockup */}
        <div className="space-y-3 pt-4">
          <h3 className="text-muted-foreground/60 text-xs font-bold tracking-wider uppercase">
            Brand lockup (Standard/Flanked)
          </h3>
          <FacetContainer
            depth={1}
            className="border-border/40 inline-flex items-center gap-4 rounded-2xl border px-6 py-4"
            style={{ background: p.bg }}
          >
            <Mark p={p} size={64} />
            <span
              className="animate-in fade-in text-4xl font-extrabold tracking-tight transition-all duration-300"
              style={{
                color: p.a === "#ffffff" ? "#0f172a" : p.a,
                fontFamily: `'${p.fontFamily}', sans-serif`,
              }}
            >
              {wordmarkText}
            </span>
          </FacetContainer>
        </div>

        {/* Visual Documentation Card */}
        <FacetCard className="border-border/40 bg-card/40 relative max-w-2xl space-y-2 overflow-hidden border p-5 text-left">
          <TextureOverlay texture="diamonds" className="opacity-[0.03] mix-blend-overlay" />
          <h4 className="text-foreground relative z-10 flex items-center gap-1.5 text-xs font-bold">
            <BookOpen className="h-3.5 w-3.5 text-[#0091ff]" /> Brand Concept & Philosophy
          </h4>
          <p className="text-muted-foreground relative z-10 text-xs leading-relaxed">
            Onoma generates names by mimicking the biological blueprint of language. The
            double-helix braid ring represents the **generative grammar plasmid**, while the
            embedded IPA phonetic symbols represent **phonological mutations**. This merges machine
            creation with the organic history of human pronunciation.
          </p>
        </FacetCard>
      </div>

      {/* Control Sidebar */}
      <div className="space-y-5 text-left">
        {/* Core Brand settings */}
        <FacetCard className="border-border/40 bg-card/40 relative space-y-4 overflow-hidden border p-5">
          <TextureOverlay texture="diamonds" className="opacity-[0.02] mix-blend-overlay" />
          <h2 className="text-foreground relative z-10 flex items-center gap-1.5 text-sm font-bold">
            🌳 Brand DNA & Typography
          </h2>

          <div className="relative z-10 space-y-3.5">
            {/* Logo Variation Select */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground block text-[11px] font-semibold">
                Logo Presentation Mode
              </Label>
              <select
                value={p.variation}
                onChange={(e) => set("variation", e.target.value)}
                className="border-border/40 bg-background/50 text-foreground w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:ring-[#0091ff] focus:outline-none"
              >
                <option value="language-tree">
                  Tree Option A: Phylogenetic Language Cladogram
                </option>
                <option value="clean">Plasmid Option B: Clean Helix Ring</option>
                <option value="nucleus">Plasmid Option C: Phonetic Nucleus (Schwa Core)</option>
                <option value="crossings">Plasmid Option D: Crossing Nodes (Badge Ring)</option>
                <option value="orbit">Plasmid Option E: Orbital Glyphs (Outer Script)</option>
                <option value="linear-dna">Strand Option F: Traditional DNA Helix (Linear)</option>
                <option value="acoustic-wave">
                  Wave Option G: Acoustic Soundwave DNA (horizontal)
                </option>
              </select>
            </div>

            {/* Google Font Selector */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground block text-[11px] font-semibold">
                Wordmark Font Family (Google Fonts)
              </Label>
              <select
                value={p.fontFamily}
                onChange={(e) => set("fontFamily", e.target.value)}
                className="border-border/40 bg-background/50 text-foreground w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:ring-[#0091ff] focus:outline-none"
              >
                {GOOGLE_FONTS.map((font) => (
                  <option key={font.id} value={font.family}>
                    {font.family} ({font.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Flanking Style Selector */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground block text-[11px] font-semibold">
                Typographical Flanking Style
              </Label>
              <select
                value={p.flankingStyle}
                onChange={(e) => set("flankingStyle", e.target.value)}
                className="border-border/40 bg-background/50 text-foreground w-full rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:ring-[#0091ff] focus:outline-none"
              >
                <option value="brackets">Angle Brackets: ⟨Onoma⟩</option>
                <option value="slashes">Phonemic Slashes: /Onoma/</option>
                <option value="brackets-square">Phonetic Brackets: [Onoma]</option>
                <option value="asterisk">Proto-Asterisk: *Onoma</option>
                <option value="ipa">Full IPA Suffix: Onoma [oʊˈnoʊmə]</option>
                <option value="none">Standard title: Onoma</option>
              </select>
            </div>

            {/* Custom Phonetic Symbol */}
            {(p.variation === "language-tree" ||
              p.variation === "nucleus" ||
              p.variation === "flanking" ||
              p.variation === "clean") && (
              <div className="border-border/20 space-y-3 border-t pt-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground block text-[11px] font-semibold">
                    Core Phoneme Symbol
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      maxLength={3}
                      value={p.nucleusSymbol}
                      onChange={(e) => set("nucleusSymbol", e.target.value)}
                      className="text-foreground bg-background/50 border-border/40 h-8 w-16 text-center text-xs font-bold"
                    />
                    <div className="flex flex-wrap gap-1">
                      {["ə", "Ω", "あ", "ʃ", "ð", "θ", "A"].map((sym) => (
                        <button
                          key={sym}
                          onClick={() => set("nucleusSymbol", sym)}
                          className="border-border/40 bg-secondary/20 hover:bg-secondary/40 cursor-pointer rounded border px-2 py-1 font-mono text-xs font-bold transition-colors"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FacetCard>

        {/* Collapsible Advanced Helix Settings */}
        <details className="border-border/40 bg-card/20 group overflow-hidden rounded-xl border transition-all duration-300">
          <summary className="text-foreground hover:bg-secondary/10 flex cursor-pointer items-center justify-between px-5 py-3 text-xs font-bold select-none focus:outline-none">
            <span>⚙️ Secondary Helix Settings</span>
            <span className="text-[10px] opacity-60 transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>
          <div className="border-border/20 space-y-4 border-t p-5">
            <div className="space-y-3">
              <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Geometry
              </h4>
              <Slider
                label="Crossings (k)"
                value={p.k}
                min={3}
                max={12}
                step={1}
                onChange={(v) => set("k", v)}
              />
              <Slider
                label="Radius (R)"
                value={p.R}
                min={20}
                max={40}
                step={1}
                onChange={(v) => set("R", v)}
              />
              <Slider
                label="Amplitude (A)"
                value={p.A}
                min={1}
                max={16}
                step={0.5}
                onChange={(v) => set("A", v)}
              />
              <Slider
                label="Stroke Weight"
                value={p.width}
                min={2}
                max={12}
                step={0.5}
                onChange={(v) => set("width", v)}
              />
              <Slider
                label="Strand Phase"
                value={p.phase}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => set("phase", v)}
              />
            </div>

            <div className="border-border/20 space-y-3 border-t pt-3">
              <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Colors
              </h4>
              <Color label="Strand A (Core)" value={p.a} onChange={(v) => set("a", v)} />
              <Color label="Strand B (Accent)" value={p.b} onChange={(v) => set("b", v)} />
              <Color label="Backdrop BG" value={p.bg} onChange={(v) => set("bg", v)} />
              <div className="flex items-center justify-between pt-1">
                <Label className="text-muted-foreground text-xs font-semibold">
                  Interweave Strands
                </Label>
                <input
                  type="checkbox"
                  checked={p.weave}
                  onChange={(e) => set("weave", e.target.checked)}
                  className="border-border/40 h-4 w-4 cursor-pointer rounded accent-[#0091ff]"
                />
              </div>
            </div>
          </div>
        </details>

        {/* Export & Actions */}
        <div className="space-y-3">
          <Button
            onClick={() =>
              saveBrand.mutate({
                variation: p.variation,
                nucleusSymbol: p.nucleusSymbol,
                flankingStyle: p.flankingStyle,
                fontFamily: p.fontFamily,
              })
            }
            disabled={saveBrand.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-full cursor-pointer text-xs font-semibold"
          >
            {saveBrand.isPending ? "Saving Brand Config..." : "Save Brand Config Globally"}
          </Button>

          <Button
            variant="outline"
            onClick={copy}
            className="border-border/40 hover:bg-secondary/40 text-foreground h-10 w-full cursor-pointer bg-transparent text-xs font-semibold"
          >
            {copied ? "Copied SVG Markup!" : "Copy SVG Code"}
          </Button>

          {/* Quick Presets */}
          <FacetCard className="border-border/40 bg-secondary/10 relative space-y-2 overflow-hidden border p-4">
            <TextureOverlay texture="diamonds" className="opacity-[0.01] mix-blend-overlay" />
            <span className="text-muted-foreground/60 relative z-10 block text-[10px] font-bold tracking-wider uppercase">
              Quick Presets
            </span>
            <div className="relative z-10 flex flex-wrap gap-1.5">
              <button
                className="border-border/40 bg-background/60 hover:bg-background/80 text-foreground cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors"
                onClick={() => setP(DEFAULTS)}
              >
                Default Cladogram
              </button>
              <button
                className="border-border/40 bg-background/60 hover:bg-background/80 text-foreground cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors"
                onClick={() =>
                  setP({
                    ...DEFAULTS,
                    a: "#0f172a",
                    b: "#0f172a",
                    bg: "#f8fafc",
                    variation: "linear-dna",
                  })
                }
              >
                Traditional DNA
              </button>
              <button
                className="border-border/40 bg-background/60 hover:bg-background/80 text-foreground cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors"
                onClick={() =>
                  setP({
                    ...DEFAULTS,
                    a: "#3b82f6",
                    b: "#10b981",
                    bg: "#0f172a",
                    variation: "clean",
                  })
                }
              >
                Clean Plasmid
              </button>
            </div>
          </FacetCard>
        </div>
      </div>
    </div>
  );
}
