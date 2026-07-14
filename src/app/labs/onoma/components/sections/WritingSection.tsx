"use client";

// src/app/labs/onoma/components/sections/WritingSection.tsx
// Onoma Lab — Writing System Studio (Glyph Forge) Section

import { useState, useRef, useEffect } from "react";
import { Feather, Trash2, RotateCcw, Save, Type, Eye } from "lucide-react";
import { FacetMaterial } from "~/components/facet-ui";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface Glyph {
  id: string;
  phoneme: string;
  svgPath: string;
  unicode?: string;
}

export default function WritingSection() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Selected system state
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  // System Form States
  const [systemName, setSystemName] = useState("");
  const [scriptType, setScriptType] = useState("alphabet");
  const [direction, setDirection] = useState("ltr");
  const [glyphSize, setGlyphSize] = useState(48);
  const [baselineOffset, setBaselineOffset] = useState(0);

  // Glyphs and Ligatures
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);

  // Editor states
  const [editingGrapheme, setEditingGrapheme] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [svgPath, setSvgPath] = useState("");
  const [testText, setTestText] = useState("aba");

  const canvasRef = useRef<SVGSVGElement | null>(null);
  const currentPathRef = useRef<string>("");

  // Queries
  const { data: systems, isLoading: listLoading } = api.onoma.listSystems.useQuery();

  // Mutations
  const saveSystemMutation = api.onoma.saveSystem.useMutation({
    onSuccess: (data: any) => {
      notify.success(`Writing system '${data.name}' saved.`);
      setSelectedSystemId(data.id);
      void utils.onoma.listSystems.invalidate();
    },
    onError: (err: any) => {
      notify.error(`Failed to save writing system: ${err.message}`);
    },
  });

  const deleteSystemMutation = api.onoma.deleteSystem.useMutation({
    onSuccess: () => {
      notify.success("Writing system deleted.");
      setSelectedSystemId(null);
      void utils.onoma.listSystems.invalidate();
    },
    onError: (err: any) => {
      notify.error(`Failed to delete writing system: ${err.message}`);
    },
  });

  // Sync state when selection changes
  useEffect(() => {
    if (selectedSystemId && systems) {
      const s = systems.find((sys: any) => sys.id === selectedSystemId);
      if (s) {
        setSystemName(s.name);
        setScriptType(s.scriptType);
        setDirection(s.direction);
        setGlyphSize(s.glyphSize);
        setBaselineOffset(s.baselineOffset);
        setGlyphs((s.glyphs as Glyph[]) || []);
      }
    } else {
      setSystemName("New Writing System");
      setScriptType("alphabet");
      setDirection("ltr");
      setGlyphSize(48);
      setBaselineOffset(0);
      setGlyphs([]);
    }
  }, [selectedSystemId, systems]);

  // Drawing Pad Handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    currentPathRef.current = `M ${x} ${y}`;
    setSvgPath(currentPathRef.current);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    currentPathRef.current += ` L ${x} ${y}`;
    setSvgPath(currentPathRef.current);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    currentPathRef.current = "";
    setSvgPath("");
  };

  // Add or update glyph
  const handleSaveGlyph = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrapheme.trim()) {
      notify.error("Grapheme/phoneme label is required.");
      return;
    }
    if (!svgPath) {
      notify.error("Draw a glyph first.");
      return;
    }

    const key = editingGrapheme.trim().toLowerCase();
    const existingIdx = glyphs.findIndex((g) => g.phoneme === key);

    const newGlyph: Glyph = {
      id: crypto.randomUUID(),
      phoneme: key,
      svgPath,
    };

    const updatedGlyphs = [...glyphs];
    if (existingIdx >= 0) {
      updatedGlyphs[existingIdx] = newGlyph;
      notify.success(`Updated glyph for '${key}'`);
    } else {
      updatedGlyphs.push(newGlyph);
      notify.success(`Added glyph for '${key}'`);
    }

    setGlyphs(updatedGlyphs);
    setEditingGrapheme("");
    clearCanvas();
  };

  const handleRemoveGlyph = (id: string) => {
    setGlyphs((prev) => prev.filter((g) => g.id !== id));
  };

  const handleSaveSystem = () => {
    if (!systemName) return;
    saveSystemMutation.mutate({
      id: selectedSystemId || undefined,
      name: systemName,
      scriptType,
      direction,
      glyphs,
      glyphSize,
      baselineOffset,
    });
  };

  // Test sentence translator/renderer
  const renderedTestGlyphs = () => {
    // Sort glyphs by length descending to match longest phonemes/ligatures first (greedy match)
    const sortedGlyphs = [...glyphs].sort((a, b) => b.phoneme.length - a.phoneme.length);

    let text = testText.toLowerCase();
    const result: React.ReactNode[] = [];
    let keyIndex = 0;

    while (text.length > 0) {
      let matched = false;
      for (const glyph of sortedGlyphs) {
        if (text.startsWith(glyph.phoneme)) {
          result.push(
            <div
              key={`${glyph.phoneme}-${keyIndex++}`}
              className="inline-block border border-border/10 p-1.5 rounded bg-secondary/5 hover:bg-secondary/15 transition-colors text-center"
              title={glyph.phoneme}
              style={{ width: glyphSize, height: glyphSize }}
            >
              <svg
                viewBox="0 0 128 128"
                className="w-full h-full stroke-amber-400 fill-none"
                style={{
                  strokeWidth: 4,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  transform: `translateY(${baselineOffset}px)`,
                }}
              >
                <path d={glyph.svgPath} />
              </svg>
            </div>
          );
          text = text.slice(glyph.phoneme.length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Fallback for unmatched character: render plain text letter
        result.push(
          <div
            key={`fallback-${keyIndex++}`}
            className="inline-flex items-center justify-center border border-dashed border-border/20 rounded text-xs font-mono text-muted-foreground"
            style={{ width: glyphSize, height: glyphSize }}
          >
            {text[0]}
          </div>
        );
        text = text.slice(1);
      }
    }

    return result;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-foreground text-xl font-bold tracking-tight">
          Writing System Studio (Glyph Forge)
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Design custom stroke glyphs, configure script layout properties, and render orthographic text.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Systems directory & properties */}
        <div className="lg:col-span-4 space-y-4">
          <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border/10">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Feather className="h-4 w-4 text-amber-500" />
                Script Directory
              </h3>
              <button
                onClick={() => setSelectedSystemId(null)}
                className="text-[10px] text-amber-500 hover:text-amber-400 font-bold cursor-pointer"
              >
                + New Script
              </button>
            </div>

            {listLoading ? (
              <div className="text-xs text-muted-foreground">Loading scripts...</div>
            ) : systems?.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No scripts saved yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {systems?.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSystemId(s.id)}
                    className={`px-3 py-1.5 rounded text-xs transition-colors border ${
                      selectedSystemId === s.id
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "hover:bg-secondary/15 border-transparent text-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </FacetMaterial>

          {/* Script Settings */}
          <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Script Settings
              </h4>
              {selectedSystemId && (
                <button
                  type="button"
                  onClick={() => deleteSystemMutation.mutate({ id: selectedSystemId })}
                  className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-muted-foreground font-medium mb-1">Script Name</label>
                <input
                  type="text"
                  required
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Typology</label>
                  <select
                    value={scriptType}
                    onChange={(e) => setScriptType(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
                  >
                    <option value="alphabet">Alphabet</option>
                    <option value="syllabary">Syllabary</option>
                    <option value="abjad">Abjad</option>
                    <option value="logographic">Logographic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
                  >
                    <option value="ltr">Left to Right</option>
                    <option value="rtl">Right to Left</option>
                    <option value="ttb">Top to Bottom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Glyph Size (px)</label>
                  <input
                    type="number"
                    value={glyphSize}
                    onChange={(e) => setGlyphSize(Number(e.target.value))}
                    className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Baseline Shift</label>
                  <input
                    type="number"
                    value={baselineOffset}
                    onChange={(e) => setBaselineOffset(Number(e.target.value))}
                    className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveSystem}
                disabled={saveSystemMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-xs cursor-pointer active:scale-95 transition-all"
              >
                <Save className="h-4 w-4" /> Save Script System
              </button>
            </div>
          </FacetMaterial>
        </div>

        {/* Right Column: Editor Workspace & Sandbox */}
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Drawing Board */}
            <div className="md:col-span-6">
              <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                  <Feather className="h-4.5 w-4.5 text-amber-500" />
                  Glyph Forge Canvas
                </h4>

                <div className="border border-border/25 rounded-lg bg-black/40 relative aspect-square flex items-center justify-center overflow-hidden">
                  <svg
                    ref={canvasRef}
                    className="w-full h-full cursor-crosshair touch-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {/* Gridlines */}
                    <line x1="0" y1="64" x2="128" y2="64" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <line x1="64" y1="0" x2="64" y2="128" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <line x1="0" y1="32" x2="128" y2="32" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    <line x1="0" y1="96" x2="128" y2="96" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    <line x1="32" y1="0" x2="32" y2="128" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    <line x1="96" y1="0" x2="96" y2="128" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />

                    {/* Dotted circle helper */}
                    <circle cx="64" cy="64" r="48" fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="4" />

                    {/* Current Stroke */}
                    {svgPath && (
                      <path
                        d={svgPath}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>

                  {/* Actions layer */}
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <button
                      onClick={clearCanvas}
                      title="Clear Canvas"
                      className="p-1.5 rounded bg-black/60 hover:bg-black text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveGlyph} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={editingGrapheme}
                    onChange={(e) => setEditingGrapheme(e.target.value)}
                    placeholder="Grapheme (e.g. sh)"
                    className="flex-1 px-2.5 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded font-bold text-xs cursor-pointer active:scale-95 transition-all"
                  >
                    Forge Glyph
                  </button>
                </form>
              </FacetMaterial>
            </div>

            {/* Glyph Registry */}
            <div className="md:col-span-6">
              <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-3 h-full flex flex-col">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="h-4.5 w-4.5 text-muted-foreground" />
                  Glyph Map Registry
                </h4>

                {glyphs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-muted-foreground italic border border-dashed border-border/10 rounded-lg p-6">
                    No glyphs mapped yet. Use the drawing canvas to design glyphs.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto max-h-[260px] grid grid-cols-3 gap-2 pr-1 scrollbar-thin">
                    {glyphs.map((g) => (
                      <div
                        key={g.id}
                        className="p-2 border border-border/15 rounded bg-secondary/5 hover:bg-secondary/10 flex flex-col items-center relative group"
                      >
                        <div className="w-10 h-10 flex items-center justify-center">
                          <svg viewBox="0 0 128 128" className="w-full h-full stroke-foreground fill-none" style={{ strokeWidth: 8, strokeLinecap: "round", strokeLinejoin: "round" }}>
                            <path d={g.svgPath} />
                          </svg>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground mt-1 bg-secondary/20 px-1.5 rounded">
                          {g.phoneme}
                        </span>

                        <button
                          onClick={() => handleRemoveGlyph(g.id)}
                          className="absolute -top-1 -right-1 p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </FacetMaterial>
            </div>
          </div>

          {/* Sandbox Test Renderer */}
          <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="h-4.5 w-4.5 text-amber-500" />
              Orthography Render Sandbox
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Type phonemes (e.g. sh-a-b-a)"
                className="flex-1 px-3 py-2 border rounded bg-background/50 border-border/40 text-foreground text-sm focus:outline-none"
              />
            </div>

            <div
              className={`p-4 rounded-lg bg-black/40 border border-border/10 flex gap-2 flex-wrap items-center min-h-[64px]`}
              style={{ flexDirection: direction === "rtl" ? "row-reverse" : "row" }}
            >
              {glyphs.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">Add glyphs above to test rendering conlang words.</span>
              ) : (
                renderedTestGlyphs()
              )}
            </div>
          </FacetMaterial>
        </div>
      </div>
    </div>
  );
}
