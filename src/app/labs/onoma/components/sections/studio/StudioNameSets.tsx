"use client";

// src/app/labs/onoma/components/sections/studio/StudioNameSets.tsx
// Onoma Studio — Full-name generator. Combines dictionaries tagged into a Name Set
// (role + gender) via a configurable template, Markov-generating each part.

import { useMemo, useState, useEffect } from "react";
import { Wand2, Info, Plus, Trash2, Users } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { NameResultCard } from "../../shared/NameResultCard";
import { useNameBank } from "~/hooks/useNameBank";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import {
  NAME_ROLES,
  NAME_GENDERS,
  defaultTemplate,
  genderMatches,
  type NameRole,
  type NameGender,
  type NameSlot,
} from "~/lib/onoma/name-sets";

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
        return;
      } catch {
        /* fall through to default */
      }
    }
    const tpl = defaultTemplate(rolesPresent);
    setSlots(tpl.slots);
    setSeparator(tpl.separator);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSet]);

  // Persist template per set.
  useEffect(() => {
    if (!selectedSet || typeof window === "undefined") return;
    localStorage.setItem(
      `onoma-nameset-tpl-${selectedSet}`,
      JSON.stringify({ slots, separator })
    );
  }, [selectedSet, slots, separator]);

  const generate = () => {
    if (slots.length === 0 || activeDicts.length === 0) return;

    // Build one Markov chain per unique slot (role+gender) for this batch.
    const chainCache = new Map<string, { chain: MarkovChain; words: string[] } | null>();
    const chainFor = (slot: NameSlot) => {
      const key = `${slot.role}|${slot.gender}`;
      if (chainCache.has(key)) return chainCache.get(key);
      const words = activeDicts
        .filter((d) => d.role === slot.role && genderMatches(slot.gender, d.gender))
        .flatMap((d) => d.values)
        .flatMap((v) => v.split(/[\r\n,\s]+/))
        .map((v) => v.trim())
        .filter(Boolean);
      if (words.length === 0) {
        chainCache.set(key, null);
        return null;
      }
      const chain = new MarkovChain(3);
      chain.addWords(words);
      const entry = { chain, words };
      chainCache.set(key, entry);
      return entry;
    };

    const out: string[] = [];
    const opts = { minLength: 3, maxLength: 12, allowDuplicates: true };
    for (let i = 0; i < batchCount; i++) {
      const parts = slots.map((slot) => {
        const c = chainFor(slot);
        if (!c) return "";
        const tok =
          c.chain.generate(opts) || c.words[Math.floor(Math.random() * c.words.length)];
        return MarkovChain.capitalize(tok);
      });
      const full = parts.filter(Boolean).join(separator);
      if (full) out.push(full);
    }
    setNames(out);
  };

  const updateSlot = (idx: number, patch: Partial<NameSlot>) =>
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

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
              <select
                value={selectedSet}
                onChange={(e) => setSelectedSet(e.target.value)}
                className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-1.5 text-sm focus:border-[#0091ff]/50 focus:outline-none"
              >
                {setNameKeys.map((s) => (
                  <option key={s} value={s}>
                    {s} ({sets.get(s)?.length} dicts)
                  </option>
                ))}
              </select>
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
              <div className="border-border/40 space-y-2.5 border-t pt-3">
                <h3 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Full-Name Template
                </h3>
                {slots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={slot.role}
                      onChange={(e) => updateSlot(idx, { role: e.target.value as NameRole })}
                      className="border-border/60 bg-background text-foreground flex-1 rounded-lg border px-2 py-1 text-xs focus:outline-none"
                    >
                      {NAME_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={slot.gender}
                      onChange={(e) => updateSlot(idx, { gender: e.target.value as NameGender })}
                      className="border-border/60 bg-background text-foreground w-24 rounded-lg border px-2 py-1 text-xs focus:outline-none"
                    >
                      {NAME_GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setSlots((p) => p.filter((_, i) => i !== idx))}
                      className="text-muted-foreground rounded p-1 hover:bg-red-500/10 hover:text-red-500"
                      title="Remove slot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setSlots((p) => [...p, { role: rolesPresent[0] ?? "given", gender: "any" }])
                  }
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
                <select
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value))}
                  className="border-border/60 bg-background text-foreground w-16 rounded-md border px-2 py-1 text-xs focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                </select>
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
