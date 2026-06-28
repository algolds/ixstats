"use client";

// src/app/labs/onoma/components/sections/studio/StudioNameSets.tsx
// Onoma Studio — Full-name generator. Combines dictionaries tagged into a Name Set
// (role + gender) via a configurable template, Markov-generating each part.

import { useMemo, useState, useEffect } from "react";
import { Wand2, Info, Plus, Trash2, Users, HelpCircle } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { NameResultCard } from "../../shared/NameResultCard";
import { useNameBank } from "~/hooks/useNameBank";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import {
  NAME_ROLES,
  NAME_GENDERS,
  defaultTemplate,
  genderMatches,
  CONVENTION_PRESETS,
  type NameRole,
  type NameGender,
  type NameSlot,
} from "~/lib/onoma/name-sets";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";

interface TaggedDict {
  values: string[];
  role: NameRole;
  gender: NameGender;
}

export function StudioNameSets() {
  const bank = useNameBank();
  const [selectedSet, setSelectedSet] = useState<string>("");
  const [separator, setSeparator] = useState(" ");
  const [slots, setSlots] = useState<NameSlot[]>([]);
  const [batchCount, setBatchCount] = useState(10);
  const [names, setNames] = useState<string[]>([]);
  const [presetKey, setPresetKey] = useState<string>("custom");

  // Group dictionaries by their Name Set tag.
  const sets = useMemo(() => {
    const map = new Map<string, TaggedDict[]>();
    for (const e of bank.nameBank ?? []) {
      const setName = (e as any).setName as string | null;
      if (e.type !== "dictionary" || !setName) continue;

      const cleanValues = (e.values || [])
        .flatMap((v: string) => v.split(/[\r\n,\s]+/))
        .map((v) => v.trim())
        .filter(Boolean);

      const dict: TaggedDict = {
        values: cleanValues,
        role: ((e as any).role as NameRole) || "given",
        gender: ((e as any).gender as NameGender) || "any",
      };
      const list = map.get(setName) ?? [];
      list.push(dict);
      map.set(setName, list);
    }
    return map;
  }, [bank.nameBank]);

  const setNameKeys = useMemo(() => Array.from(sets.keys()).sort(), [sets]);

  // Default the selected set + template when sets load / change.
  useEffect(() => {
    if (setNameKeys.length === 0) return;
    if (!selectedSet || !sets.has(selectedSet)) {
      setSelectedSet(setNameKeys[0]);
    }
  }, [setNameKeys, selectedSet, sets]);

  const activeDicts = useMemo(
    () => (selectedSet ? sets.get(selectedSet) ?? [] : []),
    [selectedSet, sets]
  );
  const rolesPresent = useMemo(
    () => Array.from(new Set(activeDicts.map((d) => d.role))),
    [activeDicts]
  );

  // Load template from localStorage or build a default when the set changes.
  useEffect(() => {
    if (!selectedSet) return;
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem(`onoma-nameset-tpl-${selectedSet}`)
        : null;
    if (saved) {
      try {
        const tpl = JSON.parse(saved);
        setSlots(tpl.slots ?? []);
        setSeparator(tpl.separator || " ");
        setPresetKey(tpl.presetKey || "custom");
        return;
      } catch {
        /* fall through to default */
      }
    }
    const tpl = defaultTemplate(rolesPresent);
    setSlots(tpl.slots);
    setSeparator(tpl.separator);
    setPresetKey("custom");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSet]);

  // Persist template per set.
  useEffect(() => {
    if (!selectedSet || typeof window === "undefined") return;
    localStorage.setItem(
      `onoma-nameset-tpl-${selectedSet}`,
      JSON.stringify({ slots, separator, presetKey })
    );
  }, [selectedSet, slots, separator, presetKey]);

  const handlePresetChange = (key: string) => {
    setPresetKey(key);
    const preset = CONVENTION_PRESETS.find((p) => p.key === key);
    if (preset) {
      setSlots(preset.template.slots);
      setSeparator(preset.template.separator);
    }
  };

  const generate = () => {
    if (slots.length === 0 || activeDicts.length === 0) return;

    // Build one Markov chain per unique slot (role+gender) for this batch.
    const chainCache = new Map<string, { chain: MarkovChain; words: string[] } | null>();
    const chainFor = (role: NameRole, gender: NameGender) => {
      const key = `${role}|${gender}`;
      if (chainCache.has(key)) return chainCache.get(key);
      const words = activeDicts
        .filter((d) => d.role === role && genderMatches(gender, d.gender))
        .flatMap((d) => d.values)
        .flatMap((v) => v.split(/[\r\n,\s]+/))
        .map((v) => v.trim())
        .filter(Boolean);
      if (words.length === 0) {
        chainCache.set(key, null);
        return null;
      }
      const chain = new MarkovChain(2);
      chain.addWords(words);
      const entry = { chain, words };
      chainCache.set(key, entry);
      return entry;
    };

    const out: string[] = [];
    const opts = { minLength: 3, maxLength: 12, allowDuplicates: true };
    for (let i = 0; i < batchCount; i++) {
      // 1. Roll a unified name gender
      const nameGender: "male" | "female" = Math.random() > 0.5 ? "male" : "female";

      const parts = slots.map((slot) => {
        // 2. Resolve gender
        const slotGender = slot.genderMode === "aligned" ? nameGender : slot.gender;
        const targetGender = slotGender === "any" ? nameGender : slotGender;

        let token = "";

        // 3. Matronymic / Patronymic Generation
        if (slot.role === "matronymic" || slot.role === "patronymic") {
          if (slot.parentName) {
            token = slot.parentName;
          } else {
            // Generate a random parent name: female for matronymic, male for patronymic
            const parentGender = slot.role === "matronymic" ? "female" : "male";
            const c = chainFor("given", parentGender) || chainFor("given", "any");
            if (c) {
              token = c.chain.generate(opts) || c.words[Math.floor(Math.random() * c.words.length)];
            }
          }
        } else {
          // Standard generation
          const c = chainFor(slot.role, targetGender) || chainFor(slot.role, "any");
          if (c) {
            token = c.chain.generate(opts) || c.words[Math.floor(Math.random() * c.words.length)];
          }
        }

        if (!token) return "";

        // 4. Apply capitalization
        token = MarkovChain.capitalize(token);

        // 5. Apply Suffix Rule
        let finalSuffix = slot.suffix || "";
        if (slot.suffixRule === "hendalarsk-matronymic") {
          finalSuffix = targetGender === "male" ? "són" : targetGender === "female" ? "toschter" : "kind";
        } else if (slot.suffixRule === "yonderian-patronymic") {
          finalSuffix = targetGender === "male" ? "son" : "daughter";
        } else if (slot.suffixRule === "caphirian-lineage") {
          finalSuffix = slot.role === "matronymic" ? "-ramus" : "-proles";
        }

        return `${slot.prefix || ""}${token}${finalSuffix}`;
      });

      const full = parts.filter(Boolean).join(separator);
      if (full) out.push(full);
    }
    setNames(out);
  };

  const updateSlot = (idx: number, patch: Partial<NameSlot>) => {
    setSlots((prev) => {
      const next = prev.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      setPresetKey("custom");
      return next;
    });
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, { role: "given", gender: "any", genderMode: "aligned" }]);
    setPresetKey("custom");
  };

  const removeSlot = (idx: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
    setPresetKey("custom");
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      {/* Left: set + template config */}
      <div className="space-y-4 lg:col-span-5">
        <FacetCard className="border-border/40 bg-secondary/5 space-y-4 border p-4">
          <div className="space-y-1.5">
            <label className="text-muted-foreground flex items-center gap-1 text-xs font-bold">
              <Users className="h-3.5 w-3.5" /> Name Set
            </label>
            {setNameKeys.length > 0 ? (
              <>
                <Select value={selectedSet} onValueChange={setSelectedSet}>
                  <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground w-full rounded-lg border px-3 py-1.5 text-sm focus:border-[#0091ff]/50 focus:outline-none flex justify-between items-center transition-colors">
                    <SelectValue placeholder="Select name set" />
                  </SelectTrigger>
                  <SelectContent className="border-border/40 bg-background/95 backdrop-blur-md max-h-[250px]">
                    {setNameKeys.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                        {s} ({sets.get(s)?.length} dicts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="space-y-1.5 border-t border-border/40 pt-3">
                  <label className="text-muted-foreground flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider">
                    Naming Convention Preset
                  </label>
                  <Select value={presetKey} onValueChange={handlePresetChange}>
                    <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground w-full rounded-lg border px-3 py-1.5 text-sm focus:border-[#0091ff]/50 focus:outline-none flex justify-between items-center transition-colors">
                      <SelectValue placeholder="Select preset" />
                    </SelectTrigger>
                    <SelectContent className="border-border/40 bg-background/95 backdrop-blur-md max-h-[250px]">
                      {CONVENTION_PRESETS.map((p) => (
                        <SelectItem key={p.key} value={p.key} className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {presetKey !== "custom" && (
                  <div className="border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 rounded-xl p-3 flex gap-2 items-start text-xs animate-in fade-in duration-200">
                    <HelpCircle className="h-4 w-4 text-[#8b5cf6] flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-foreground">Convention Lore & Rules:</span>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        {presetKey === "hendalarsk" && (
                          <>
                            Most Hendalarskaren have four names: a first name (<strong>Fornám</strong>), a chosen name (<strong>Kvalnám</strong> selected on their 18th birthday), a matronymic (<strong>Muternám</strong> derived from the mother's name plus suffix based on their gender: <em>-són</em>, <em>-toschter</em>, or <em>-kind</em>), and an inherited surname (<strong>Erbnám</strong>).
                          </>
                        )}
                        {presetKey === "caphiria" && (
                          <>
                            Caphiria uses the <strong>Quadranomial system</strong> (<em>quadranomia</em>): <strong>Nomen Inscriptio</strong> (parents' chosen name), <strong>Nomen Electi</strong> (personal name chosen by the individual at age 16), <strong>Proles/Ramus</strong> (parental lineage indicating paternal or maternal branches), and <strong>Cognomina Fluminis</strong> (Estate family river-surname).
                          </>
                        )}
                        {presetKey === "urcea" && (
                          <>
                            The <strong>Tria nomina movement</strong> revived classical Levantine naming conventions: <strong>Praenomen</strong> (given name), <strong>Nomen</strong> (Estate name, defaults to <em>Julianus</em> for commoners under the King's patronage), and <strong>Cognomen</strong> (family surname) plus optional honorary <strong>Agnomen</strong> (victory title).
                          </>
                        )}
                        {presetKey === "yonderian-noble" && (
                          <>
                            Yonderian nobles carry a geographical surname representing their possessions, prefixed with the particle <strong>von</strong> (e.g. <em>von Willing</em>, <em>von Koop</em>).
                          </>
                        )}
                        {presetKey === "yonderian-peasant" && (
                          <>
                            Yonderian peasantry carry simple given names followed by patronymics consisting of the father's given name suffixed with <strong>-son</strong> or <strong>-daughter</strong>.
                          </>
                        )}
                        {presetKey === "khunyer" && (
                          <>
                            Khunyer naming conventions reverse standard order, placing the <strong>surname / family name</strong> before the given name (e.g. <em>Szabolcs Anton</em>, where Szabolcs is the surname).
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="border-border/40 text-muted-foreground rounded-lg border border-dashed p-4 text-xs">
                No Name Sets yet. In <strong>Stash</strong>, upload your name files and tag each
                with a role (given/surname), gender, and a shared Set name.
              </div>
            )}
          </div>

          {selectedSet && (
            <>
              <div className="text-muted-foreground flex flex-wrap gap-1.5 text-[10px]">
                {activeDicts.map((d, i) => (
                  <span
                    key={i}
                    className="rounded bg-[#0091ff]/10 px-1.5 py-0.5 font-bold text-[#0091ff] capitalize"
                  >
                    {d.role}
                    {d.gender !== "any" ? ` · ${d.gender}` : ""} ({d.values.length})
                  </span>
                ))}
              </div>

              {/* Template slots */}
              <div className="border-border/40 space-y-3 border-t pt-3">
                <h3 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Full-Name Template Builder
                </h3>
                {slots.map((slot, idx) => {
                  const showParentInput = slot.role === "matronymic" || slot.role === "patronymic";
                  return (
                    <div key={idx} className="border border-border/30 rounded-xl bg-background/40 p-2.5 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-[10px] font-bold">#{idx + 1}</span>
                        <Select value={slot.role} onValueChange={(val) => updateSlot(idx, { role: val as NameRole })}>
                          <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex-1 rounded-lg border px-2 py-1 text-xs focus:outline-none font-semibold flex justify-between items-center transition-colors">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="border-border/40 bg-background/95 backdrop-blur-md max-h-[250px]">
                            {NAME_ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value} className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={slot.gender} onValueChange={(val) => updateSlot(idx, { gender: val as NameGender })}>
                          <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground w-24 rounded-lg border px-2 py-1 text-xs focus:outline-none flex justify-between items-center transition-colors">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent className="border-border/40 bg-background/95 backdrop-blur-md max-h-[200px]">
                            {NAME_GENDERS.map((g) => (
                              <SelectItem key={g.value} value={g.value} className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                                {g.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <button
                          onClick={() => removeSlot(idx)}
                          className="text-muted-foreground hover:text-rose-500 rounded p-1 cursor-pointer"
                          title="Remove slot"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Advanced Options Sub-Grid */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-border/10 pt-2">
                        {/* Prefix */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground font-bold uppercase tracking-wider">Prefix</span>
                          <input
                            value={slot.prefix || ""}
                            onChange={(e) => updateSlot(idx, { prefix: e.target.value })}
                            placeholder="e.g. von"
                            className="border-border/60 bg-background text-foreground rounded-md border px-2 py-0.5 text-xs focus:outline-none font-mono"
                          />
                        </div>

                        {/* Suffix Rule */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground font-bold uppercase tracking-wider">Suffix Rule</span>
                          <Select value={slot.suffixRule || "none"} onValueChange={(val) => updateSlot(idx, { suffixRule: val as any })}>
                            <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground rounded-md border px-2 py-0.5 text-xs focus:outline-none flex justify-between items-center transition-colors">
                              <SelectValue placeholder="None / Static" />
                            </SelectTrigger>
                            <SelectContent className="border-border/40 bg-background/95 backdrop-blur-md max-h-[200px]">
                              <SelectItem value="none" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">None / Static</SelectItem>
                              <SelectItem value="hendalarsk-matronymic" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">Hendalarsk matronymic</SelectItem>
                              <SelectItem value="yonderian-patronymic" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">Yonderian patronymic</SelectItem>
                              <SelectItem value="caphirian-lineage" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">Caphirian lineage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Parent Name input (matronymic/patronymic only) */}
                        {showParentInput && (
                          <div className="flex flex-col gap-0.5 col-span-2">
                            <span className="text-muted-foreground font-bold uppercase tracking-wider">Parent Name Lock (Optional)</span>
                            <input
                              value={slot.parentName || ""}
                              onChange={(e) => updateSlot(idx, { parentName: e.target.value })}
                              placeholder="Leave blank for random Markov parent"
                              className="border-border/60 bg-background text-foreground rounded-md border px-2 py-0.5 text-xs focus:outline-none"
                            />
                          </div>
                        )}

                        {/* Gender Mode checkbox */}
                        <div className="flex flex-col gap-0.5 col-span-2 pt-0.5">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={slot.genderMode === "aligned"}
                              onChange={(e) => updateSlot(idx, { genderMode: e.target.checked ? "aligned" : "fixed" })}
                              className="rounded border-border/60 text-[#8b5cf6] focus:ring-[#8b5cf6]"
                            />
                            <span className="text-muted-foreground font-bold uppercase tracking-wider">Align with unified full-name gender</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={addSlot}
                  className="flex items-center gap-1 rounded-lg border border-[#0091ff]/20 bg-[#0091ff]/5 px-2.5 py-1 text-[11px] font-bold text-[#0091ff] hover:bg-[#0091ff]/10"
                >
                  <Plus className="h-3 w-3" /> Add slot
                </button>

                <div className="flex items-center gap-2 pt-1">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase">
                    Separator
                  </label>
                  <input
                    value={separator}
                    onChange={(e) => setSeparator(e.target.value)}
                    className="border-border/60 bg-background text-foreground w-20 rounded-lg border px-2 py-1 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Generate */}
              <div className="border-border/40 flex items-center gap-2 border-t pt-3">
                <div className="flex items-center gap-1 border border-border/60 bg-background rounded-lg p-0.5 select-none h-7">
                  <button
                    type="button"
                    onClick={() => setBatchCount((c) => Math.max(5, c - 5))}
                    disabled={batchCount <= 5}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 cursor-pointer font-bold text-xs"
                  >
                    -
                  </button>
                  <NumberFlowDisplay
                    value={batchCount}
                    className="text-foreground font-mono text-xs font-semibold px-1 min-w-[20px] text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setBatchCount((c) => Math.min(50, c + 5))}
                    disabled={batchCount >= 50}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 cursor-pointer font-bold text-xs"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={generate}
                  disabled={slots.length === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0091ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#33a7ff] disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" /> Generate Full Names
                </button>
              </div>
            </>
          )}
        </FacetCard>
      </div>

      {/* Right: results */}
      <div className="space-y-4 lg:col-span-7">
        {names.length > 0 ? (
          <FacetCard className="border-border/40 bg-secondary/5 animate-in fade-in space-y-4 border p-4 duration-300">
            <div className="border-border/40 border-b pb-3">
              <h3 className="text-foreground text-sm font-bold tracking-tight">Full Names</h3>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                Each part Markov-generated from the {selectedSet} set.
              </p>
            </div>
            <div className="grid max-h-[500px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {names.map((name, idx) => (
                <NameResultCard
                  key={`${name}-${idx}`}
                  name={name}
                  isSaved={bank.nameBank?.some(
                    (e) => e.type === "saved-name" && e.title === name
                  )}
                  onSave={async (n, stashId) => {
                    await bank.saveEntry({
                      type: "saved-name",
                      title: n,
                      values: [n],
                      stashId,
                    });
                  }}
                />
              ))}
            </div>
          </FacetCard>
        ) : (
          <FacetCard className="border-border/40 bg-secondary/5 text-muted-foreground border border-dashed p-8 text-center text-sm">
            <Info className="mx-auto mb-3 h-8 w-8 animate-pulse text-[#0091ff]/40" />
            <p className="font-semibold">Generate full names</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Pick a Name Set, arrange the template (e.g. Given + Surname), and generate.
            </p>
          </FacetCard>
        )}
      </div>
    </div>
  );
}

export default StudioNameSets;
