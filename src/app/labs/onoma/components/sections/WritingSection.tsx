// src/app/labs/onoma/components/sections/WritingSection.tsx
// Onoma Lab — Writing System Studio (Glyph Designer & Orthography Typesetting)
// Philosophy: Apple SF Symbols × IPA × Linguistic Notation × Scientific Precision

"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { Glyph, ScriptTypology, ScriptDirection } from "./writing/types";
import type { StarterScriptPack } from "./writing/glyph-primitives";
import { GlyphForgeCanvas } from "./writing/GlyphForgeCanvas";
import { GlyphMapRegistry } from "./writing/GlyphMapRegistry";
import { OrthographySandbox } from "./writing/OrthographySandbox";
import { ScriptSettingsPanel } from "./writing/ScriptSettingsPanel";

const DRAFT_SYSTEM_KEY = "onoma_writing_system_active_draft_v2";

interface WritingSectionProps {
  studioWords?: string[];
}

export default function WritingSection({ studioWords = [] }: WritingSectionProps = {}) {
  const notify = useNotify();
  const utils = api.useUtils();

  // Selected system state
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  // System Form States
  const [systemName, setSystemName] = useState("New Writing System");
  const [scriptType, setScriptType] = useState<ScriptTypology>("alphabet");
  const [direction, setDirection] = useState<ScriptDirection>("ltr");
  const [glyphSize, setGlyphSize] = useState(48);
  const [baselineOffset, setBaselineOffset] = useState(0);

  // Mapped Glyphs
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);

  // Active glyph being edited in canvas
  const [editingGlyph, setEditingGlyph] = useState<Glyph | null>(null);

  const isInitialLoadDone = useRef(false);

  // Queries
  const { data: systems, isLoading: listLoading } = api.onoma.listSystems.useQuery();

  // Mutations
  const saveSystemMutation = api.onoma.saveSystem.useMutation({
    onSuccess: (data) => {
      notify.success(`Writing system '${data.name}' saved.`);
      setSelectedSystemId(data.id);
      void utils.onoma.listSystems.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to save writing system: ${err.message}`);
    },
  });

  const deleteSystemMutation = api.onoma.deleteSystem.useMutation({
    onSuccess: () => {
      notify.success("Writing system deleted.");
      setSelectedSystemId(null);
      try {
        localStorage.removeItem(DRAFT_SYSTEM_KEY);
      } catch {
        // ignore
      }
      void utils.onoma.listSystems.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to delete writing system: ${err.message}`);
    },
  });

  // 1. Initial Load: Restore from localStorage draft or DB
  useEffect(() => {
    if (isInitialLoadDone.current) return;

    // Check localStorage draft first
    try {
      const draft = localStorage.getItem(DRAFT_SYSTEM_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.id) setSelectedSystemId(parsed.id);
        if (parsed.name) setSystemName(parsed.name);
        if (parsed.scriptType) setScriptType(parsed.scriptType);
        if (parsed.direction) setDirection(parsed.direction);
        if (parsed.glyphSize) setGlyphSize(parsed.glyphSize);
        if (parsed.baselineOffset !== undefined) setBaselineOffset(parsed.baselineOffset);
        if (Array.isArray(parsed.glyphs) && parsed.glyphs.length > 0) {
          setGlyphs(parsed.glyphs);
        }
        isInitialLoadDone.current = true;
        return;
      }
    } catch (e) {
      console.warn("Could not load draft writing system:", e);
    }

    // Otherwise if systems loaded and has elements, pick first
    if (systems && systems.length > 0 && !selectedSystemId) {
      const first = systems[0];
      setSelectedSystemId(first.id);
      setSystemName(first.name);
      setScriptType((first.scriptType as ScriptTypology) || "alphabet");
      setDirection((first.direction as ScriptDirection) || "ltr");
      setGlyphSize(first.glyphSize || 48);
      setBaselineOffset(first.baselineOffset || 0);
      setGlyphs((first.glyphs as unknown as Glyph[]) || []);
      isInitialLoadDone.current = true;
    }
  }, [systems, selectedSystemId]);

  // 2. Persist active state to localStorage whenever modified
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_SYSTEM_KEY,
        JSON.stringify({
          id: selectedSystemId,
          name: systemName,
          scriptType,
          direction,
          glyphSize,
          baselineOffset,
          glyphs,
        })
      );
    } catch (e) {
      console.warn("Failed to persist writing system draft:", e);
    }
  }, [selectedSystemId, systemName, scriptType, direction, glyphSize, baselineOffset, glyphs]);

  // 3. Sync state when user selects a different system from directory
  useEffect(() => {
    if (selectedSystemId && systems) {
      const s = systems.find((sys) => sys.id === selectedSystemId);
      if (s) {
        setSystemName(s.name);
        setScriptType((s.scriptType as ScriptTypology) || "alphabet");
        setDirection((s.direction as ScriptDirection) || "ltr");
        setGlyphSize(s.glyphSize || 48);
        setBaselineOffset(s.baselineOffset || 0);
        setGlyphs((s.glyphs as unknown as Glyph[]) || []);
        setEditingGlyph(null);
      }
    } else if (selectedSystemId === null && isInitialLoadDone.current) {
      setSystemName("New Writing System");
      setScriptType("alphabet");
      setDirection("ltr");
      setGlyphSize(48);
      setBaselineOffset(0);
      setGlyphs([]);
      setEditingGlyph(null);
    }
  }, [selectedSystemId, systems]);

  // Auto-persist helper (persists immediately to DB if existing system, otherwise maintains draft)
  const persistChanges = (updatedGlyphs: Glyph[], updatedName = systemName) => {
    setGlyphs(updatedGlyphs);

    if (selectedSystemId) {
      saveSystemMutation.mutate({
        id: selectedSystemId,
        name: updatedName,
        scriptType,
        direction,
        glyphs: updatedGlyphs as unknown as Record<string, unknown>[],
        glyphSize,
        baselineOffset,
      });
    }
  };

  // Add or update glyph in registry
  const handleSaveGlyph = (phoneme: string, svgPath: string, unicode?: string) => {
    const key = phoneme.trim().toLowerCase();
    const existingIdx = glyphs.findIndex((g) => g.phoneme.toLowerCase() === key);

    const newGlyph: Glyph = {
      id: editingGlyph ? editingGlyph.id : crypto.randomUUID(),
      phoneme: key,
      svgPath,
      unicode: unicode || undefined,
      createdAt: Date.now(),
    };

    const updated = [...glyphs];
    if (existingIdx >= 0) {
      updated[existingIdx] = newGlyph;
      notify.success(`Updated glyph ⟨${key}⟩`);
    } else {
      updated.push(newGlyph);
      notify.success(`Added glyph ⟨${key}⟩`);
    }

    persistChanges(updated);
    setEditingGlyph(null);
  };

  // Remove a glyph
  const handleRemoveGlyph = (id: string) => {
    const updated = glyphs.filter((g) => g.id !== id);
    persistChanges(updated);
    if (editingGlyph?.id === id) {
      setEditingGlyph(null);
    }
  };

  // Load a starter script pack
  const handleLoadStarterPack = (pack: StarterScriptPack) => {
    const newName = pack.name;
    setSystemName(newName);
    setScriptType(pack.typology);
    setDirection(pack.direction);
    const populatedGlyphs: Glyph[] = pack.glyphs.map((g) => ({
      id: crypto.randomUUID(),
      phoneme: g.phoneme,
      svgPath: g.svgPath,
      unicode: g.unicode,
      createdAt: Date.now(),
    }));
    persistChanges(populatedGlyphs, newName);
    setEditingGlyph(null);
    notify.success(`Loaded "${pack.name}" script with ${populatedGlyphs.length} glyphs.`);
  };

  // Explicit Save / Commit of writing system to database
  const handleSaveSystem = () => {
    if (!systemName.trim()) {
      notify.error("Script name is required.");
      return;
    }

    saveSystemMutation.mutate({
      id: selectedSystemId || undefined,
      name: systemName.trim(),
      scriptType,
      direction,
      glyphs: glyphs as unknown as Record<string, unknown>[],
      glyphSize,
      baselineOffset,
    });
  };

  // Delete current writing system
  const handleDeleteSystem = () => {
    if (!selectedSystemId) return;
    if (!confirm(`Are you sure you want to delete the writing system "${systemName}"?`)) return;
    deleteSystemMutation.mutate({ id: selectedSystemId });
  };

  // Prefill designer canvas when user clicks an unmapped phoneme in sandbox
  const handleForgeMissing = (charOrPhoneme: string) => {
    const dummyGlyph: Glyph = {
      id: crypto.randomUUID(),
      phoneme: charOrPhoneme.trim().toLowerCase(),
      svgPath: "",
    };
    setEditingGlyph(dummyGlyph);
    notify.info(`Design glyph for: '${charOrPhoneme}'`);
  };

  return (
    <div className="space-y-6">
      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Script Directory & Typology Settings (4 cols) */}
        <div className="space-y-4 lg:col-span-4">
          <ScriptSettingsPanel
            systems={systems}
            listLoading={listLoading}
            selectedSystemId={selectedSystemId}
            onSelectSystem={setSelectedSystemId}
            systemName={systemName}
            onSystemNameChange={setSystemName}
            scriptType={scriptType}
            onScriptTypeChange={setScriptType}
            direction={direction}
            onDirectionChange={setDirection}
            glyphSize={glyphSize}
            onGlyphSizeChange={setGlyphSize}
            baselineOffset={baselineOffset}
            onBaselineOffsetChange={setBaselineOffset}
            glyphs={glyphs}
            onSaveSystem={handleSaveSystem}
            onDeleteSystem={handleDeleteSystem}
            isSaving={saveSystemMutation.isPending}
            isDeleting={deleteSystemMutation.isPending}
          />
        </div>

        {/* Right Column: Glyph Designer Canvas & Glyph Registry (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Glyph Designer Canvas */}
            <div className="md:col-span-6">
              <GlyphForgeCanvas
                onSaveGlyph={handleSaveGlyph}
                editingGlyph={editingGlyph}
                onCancelEdit={() => setEditingGlyph(null)}
                existingGlyphs={glyphs}
              />
            </div>

            {/* Glyph Registry */}
            <div className="md:col-span-6">
              <GlyphMapRegistry
                glyphs={glyphs}
                onEditGlyph={(g) => setEditingGlyph(g)}
                onRemoveGlyph={handleRemoveGlyph}
                onLoadStarterPack={handleLoadStarterPack}
                selectedGlyphId={editingGlyph?.id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Orthography Render Sandbox */}
      <OrthographySandbox
        glyphs={glyphs}
        direction={direction}
        onDirectionChange={setDirection}
        glyphSize={glyphSize}
        onGlyphSizeChange={setGlyphSize}
        baselineOffset={baselineOffset}
        onBaselineOffsetChange={setBaselineOffset}
        onSelectGlyphToEdit={(g) => setEditingGlyph(g)}
        onForgeMissing={handleForgeMissing}
        studioWords={studioWords}
      />
    </div>
  );
}
