"use client";

// src/app/labs/onoma/components/sections/studio/StudioNameSets.tsx
// Onoma Studio — Full-name compositor. Combines dictionaries tagged into a Name Set
// (role + gender) via a configurable template, Markov-generating each part.

import { useMemo, useState, useEffect } from "react";
import {
  InfoCircle as Info,
  Plus,
  Trash as Trash2,
  Group as Users,
  HelpCircle,
} from "iconoir-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

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
  const [batchCount, setBatchCount] = useState(15);
  const [names, setNames] = useState<string[]>([]);
  const [presetKey, setPresetKey] = useState<string>("custom");

  // Group dictionaries by their Name Set tag.
  const sets = useMemo(() => {
    const map = new Map<string, TaggedDict[]>();
    for (const e of bank.nameBank ?? []) {
      const setName = e.setName;
      if (e.type !== "dictionary" || !setName) continue;

      const cleanValues = (e.values || [])
        .flatMap((v: string) => v.split(/[\r\n,\s]+/))
        .map((v) => v.trim())
        .filter(Boolean);

      const dict: TaggedDict = {
        values: cleanValues,
        role: (e.role as NameRole) || "given",
        gender: (e.gender as NameGender) || "any",
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
    () => (selectedSet ? (sets.get(selectedSet) ?? []) : []),
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
          finalSuffix =
            targetGender === "male" ? "són" : targetGender === "female" ? "toschter" : "kind";
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
        <FacetCard variant="inset" padding="none" className="space-y-4 p-4">
          <div className="space-y-1.5">
            <label className="text-label-secondary text-footnote flex items-center gap-1 font-semibold">
              <Users className="h-3.5 w-3.5" /> Name Set
            </label>
            {setNameKeys.length > 0 ? (
              <>
                <Select value={selectedSet} onValueChange={setSelectedSet}>
                  <SelectTrigger className="text-body w-full">
                    <SelectValue placeholder="Select name set" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    {setNameKeys.map((s) => (
                      <SelectItem key={s} value={s} className="text-footnote">
                        {s} ({sets.get(s)?.length} dicts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="border-separator space-y-1.5 border-t pt-3">
                  <label className="text-label-secondary text-subhead flex items-center gap-1">
                    Naming Convention Preset
                  </label>
                  <Select value={presetKey} onValueChange={handlePresetChange}>
                    <SelectTrigger className="text-body w-full">
                      <SelectValue placeholder="Select preset" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {CONVENTION_PRESETS.map((p) => (
                        <SelectItem key={p.key} value={p.key} className="text-footnote">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {presetKey !== "custom" && (
                  <div className="animate-in fade-in rounded-row border-indigo/20 bg-indigo/5 text-footnote flex items-start gap-2 border p-3 duration-200">
                    <HelpCircle className="text-indigo mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div className="space-y-1">
                      <span className="text-label font-semibold">Convention Lore & Rules:</span>
                      <p className="text-label-secondary text-caption leading-relaxed">
                        {presetKey === "hendalarsk" && (
                          <>
                            Most Hendalarskaren have four names: a first name (
                            <strong>Fornám</strong>), a chosen name (<strong>Kvalnám</strong>{" "}
                            selected on their 18th birthday), a matronymic (
                            <strong>Muternám</strong> derived from the mother's name plus suffix
                            based on their gender: <em>-són</em>, <em>-toschter</em>, or{" "}
                            <em>-kind</em>), and an inherited surname (<strong>Erbnám</strong>).
                          </>
                        )}
                        {presetKey === "caphiria" && (
                          <>
                            Caphiria uses the <strong>Quadranomial system</strong> (
                            <em>quadranomia</em>): <strong>Nomen Inscriptio</strong> (parents'
                            chosen name), <strong>Nomen Electi</strong> (personal name chosen by the
                            individual at age 16), <strong>Proles/Ramus</strong> (parental lineage
                            indicating paternal or maternal branches), and{" "}
                            <strong>Cognomina Fluminis</strong> (Estate family river-surname).
                          </>
                        )}
                        {presetKey === "urcea" && (
                          <>
                            The <strong>Tria nomina movement</strong> revived classical Levantine
                            naming conventions: <strong>Praenomen</strong> (given name),{" "}
                            <strong>Nomen</strong> (Estate name, defaults to <em>Julianus</em> for
                            commoners under the King's patronage), and <strong>Cognomen</strong>{" "}
                            (family surname) plus optional honorary <strong>Agnomen</strong>{" "}
                            (victory title).
                          </>
                        )}
                        {presetKey === "yonderian-noble" && (
                          <>
                            Yonderian nobles carry a geographical surname representing their
                            possessions, prefixed with the particle <strong>von</strong> (e.g.{" "}
                            <em>von Willing</em>, <em>von Koop</em>).
                          </>
                        )}
                        {presetKey === "yonderian-peasant" && (
                          <>
                            Yonderian peasantry carry simple given names followed by patronymics
                            consisting of the father's given name suffixed with{" "}
                            <strong>-son</strong> or <strong>-daughter</strong>.
                          </>
                        )}
                        {presetKey === "khunyer" && (
                          <>
                            Khunyer naming conventions reverse standard order, placing the{" "}
                            <strong>surname / family name</strong> before the given name (e.g.{" "}
                            <em>Szabolcs Anton</em>, where Szabolcs is the surname).
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="border-separator text-label-secondary rounded-control text-footnote border border-dashed p-4">
                No Name Sets yet. In <strong>Stash</strong>, upload your name files and tag each
                with a role (given/surname), gender, and a shared Set name.
              </div>
            )}
          </div>

          {selectedSet && (
            <>
              <div className="text-label-secondary text-caption flex flex-wrap gap-1.5">
                {activeDicts.map((d, i) => (
                  <span
                    key={i}
                    className="bg-tint/10 text-tint rounded-control-sm px-1.5 py-0.5 font-semibold capitalize"
                  >
                    {d.role}
                    {d.gender !== "any" ? ` · ${d.gender}` : ""} ({d.values.length})
                  </span>
                ))}
              </div>

              {/* Template slots */}
              <div className="border-separator space-y-3 border-t pt-3">
                <h3 className="text-label-secondary text-subhead">Full-Name Template Builder</h3>
                {slots.map((slot, idx) => {
                  const showParentInput = slot.role === "matronymic" || slot.role === "patronymic";
                  return (
                    <div
                      key={idx}
                      className="border-separator bg-surface rounded-row space-y-2 border p-2.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-label-secondary text-caption font-semibold">
                          #{idx + 1}
                        </span>
                        <Select
                          value={slot.role}
                          onValueChange={(val) => updateSlot(idx, { role: val as NameRole })}
                        >
                          <SelectTrigger className="text-footnote flex-1">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[250px]">
                            {NAME_ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value} className="text-footnote">
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={slot.gender}
                          onValueChange={(val) => updateSlot(idx, { gender: val as NameGender })}
                        >
                          <SelectTrigger className="text-footnote w-24">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {NAME_GENDERS.map((g) => (
                              <SelectItem key={g.value} value={g.value} className="text-footnote">
                                {g.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <button
                          onClick={() => removeSlot(idx)}
                          className="text-label-secondary rounded-control-sm hover:text-red cursor-pointer p-1"
                          title="Remove slot"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Advanced Options Sub-Grid */}
                      <div className="border-separator text-caption grid grid-cols-2 gap-2 border-t pt-2">
                        {/* Prefix */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-label-secondary font-semibold uppercase">
                            Prefix
                          </span>
                          <Input
                            value={slot.prefix || ""}
                            onChange={(e) => updateSlot(idx, { prefix: e.target.value })}
                            placeholder="e.g. von"
                            className="text-footnote font-mono"
                          />
                        </div>

                        {/* Suffix Rule */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-label-secondary font-semibold uppercase">
                            Suffix Rule
                          </span>
                          <Select
                            value={slot.suffixRule || "none"}
                            onValueChange={(
                              val:
                                | "none"
                                | "hendalarsk-matronymic"
                                | "yonderian-patronymic"
                                | "caphirian-lineage"
                            ) => updateSlot(idx, { suffixRule: val })}
                          >
                            <SelectTrigger className="text-footnote">
                              <SelectValue placeholder="None / Static" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              <SelectItem value="none" className="text-footnote">
                                None / Static
                              </SelectItem>
                              <SelectItem value="hendalarsk-matronymic" className="text-footnote">
                                Hendalarsk matronymic
                              </SelectItem>
                              <SelectItem value="yonderian-patronymic" className="text-footnote">
                                Yonderian patronymic
                              </SelectItem>
                              <SelectItem value="caphirian-lineage" className="text-footnote">
                                Caphirian lineage
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Parent Name input (matronymic/patronymic only) */}
                        {showParentInput && (
                          <div className="col-span-2 flex flex-col gap-0.5">
                            <span className="text-label-secondary font-semibold uppercase">
                              Parent Name Lock (Optional)
                            </span>
                            <Input
                              value={slot.parentName || ""}
                              onChange={(e) => updateSlot(idx, { parentName: e.target.value })}
                              placeholder="Leave blank for auto-generated parent"
                              className="text-footnote"
                            />
                          </div>
                        )}

                        {/* Gender Mode checkbox */}
                        <div className="col-span-2 flex flex-col gap-0.5 pt-0.5">
                          <label className="flex cursor-pointer items-center gap-1">
                            <input
                              type="checkbox"
                              checked={slot.genderMode === "aligned"}
                              onChange={(e) =>
                                updateSlot(idx, {
                                  genderMode: e.target.checked ? "aligned" : "fixed",
                                })
                              }
                              className="border-separator rounded-control-sm text-indigo focus:ring-indigo"
                            />
                            <span className="text-label-secondary font-semibold uppercase">
                              Align with unified full-name gender
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button variant="tinted" size="sm" onClick={addSlot}>
                  <Plus className="h-3 w-3" /> Add slot
                </Button>

                <div className="flex items-center gap-2 pt-1">
                  <label className="text-label-secondary text-subhead">Separator</label>
                  <Input
                    value={separator}
                    onChange={(e) => setSeparator(e.target.value)}
                    className="text-footnote w-20"
                  />
                </div>
              </div>

              {/* Generate */}
              <div className="border-separator flex items-center gap-2 border-t pt-3">
                <div className="border-separator bg-background rounded-control flex h-7 items-center gap-1 border p-0.5 select-none">
                  <button
                    type="button"
                    onClick={() => setBatchCount((c) => Math.max(5, c - 5))}
                    disabled={batchCount <= 5}
                    className="text-label-secondary hover:text-label text-footnote cursor-pointer px-2 font-semibold disabled:opacity-30"
                  >
                    -
                  </button>
                  <NumberFlowDisplay
                    value={batchCount}
                    className="text-label text-footnote min-w-[20px] px-1 text-center font-mono font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setBatchCount((c) => Math.min(50, c + 5))}
                    disabled={batchCount >= 50}
                    className="text-label-secondary hover:text-label text-footnote cursor-pointer px-2 font-semibold disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
                <Button
                  size="md"
                  onClick={generate}
                  disabled={slots.length === 0}
                  className="flex-1 justify-center"
                >
                  <span>Generate Full Names</span>
                </Button>
              </div>
            </>
          )}
        </FacetCard>
      </div>

      {/* Right: results */}
      <div className="space-y-4 lg:col-span-7">
        {names.length > 0 ? (
          <FacetCard
            variant="inset"
            padding="none"
            className="animate-in fade-in space-y-4 p-4 duration-300"
          >
            <div className="border-separator border-b pb-3">
              <h3 className="text-label text-body font-semibold">Full Names</h3>
              <p className="text-label-secondary text-caption mt-0.5">
                Each slot generated from the {selectedSet} template.
              </p>
            </div>
            <div className="grid max-h-[500px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {names.map((name, idx) => (
                <NameResultCard
                  key={`${name}-${idx}`}
                  name={name}
                  isSaved={bank.nameBank?.some((e) => e.type === "saved-name" && e.title === name)}
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
          <FacetCard
            variant="inset"
            padding="none"
            className="text-label-secondary text-body border-dashed p-8 text-center"
          >
            <Info className="text-tint/40 mx-auto mb-3 h-8 w-8" />
            <p className="font-semibold">Generate full names</p>
            <p className="text-label-secondary text-footnote mt-1">
              Pick a Name Set, arrange the template (e.g. Given + Surname), and generate.
            </p>
          </FacetCard>
        )}
      </div>
    </div>
  );
}

export default StudioNameSets;
