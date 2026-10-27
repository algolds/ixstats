"use client";

import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SearchField } from "~/components/ui/search-field";

/**
 * The realm's continent table: source nation key to continent, both free text (no fixed list of continents).
 * A blank continent means unknown and is dropped when saved. Saved with the rest of the settings.
 */
export function ContinentTable({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const [query, setQuery] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newContinent, setNewContinent] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(value)
      .filter(([key, continent]) => !q || key.toLowerCase().includes(q) || continent.toLowerCase().includes(q))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [value, query]);
  const continents = useMemo(
    () => [...new Set(Object.values(value).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [value]
  );

  const set = (key: string, continent: string) => onChange({ ...value, [key]: continent });
  const remove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };
  const add = () => {
    const key = newKey.trim();
    if (!key) return;
    set(key, newContinent.trim());
    setNewKey("");
    setNewContinent("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="text-label text-headline">Continents</h4>
          <p className="text-label-secondary text-footnote">
            {Object.keys(value).length} nations placed
            {continents.length > 0 && <> in {continents.join(", ")}</>}. Keys are the source&apos;s nation
            keys. A first guess is fine: correct it here and the next run applies it.
          </p>
        </div>
        <SearchField
          size="sm"
          value={query}
          onValueChange={setQuery}
          placeholder="Find a key or continent"
          aria-label="Find a key or continent"
          containerClassName="w-56"
        />
      </div>
      <datalist id="realm-continents">
        {continents.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="border-separator rounded-row max-h-80 overflow-y-auto border">
        <table className="w-full">
          <thead className="bg-fill-4 text-label-secondary text-footnote sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nation key</th>
              <th className="px-3 py-2 text-left font-medium">Continent</th>
              <th className="px-3 py-2" aria-label="Remove" />
            </tr>
          </thead>
          <tbody className="divide-separator divide-y">
            {rows.map(([key, continent]) => (
              <tr key={key}>
                <td className="text-label text-footnote px-3 py-1 font-mono">{key}</td>
                <td className="px-3 py-1">
                  <Input
                    value={continent}
                    list="realm-continents"
                    onChange={(e) => set(key, e.target.value)}
                    aria-label={`Continent of ${key}`}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                  />
                </td>
                <td className="px-3 py-1 text-right">
                  <Button size="xs" variant="ghost" onClick={() => remove(key)} aria-label={`Remove ${key}`}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="text-label-secondary text-footnote px-3 py-3">
                  No entries{query ? " match" : " yet"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Nation key"
          aria-label="New nation key"
          className="w-48"
        />
        <Input
          value={newContinent}
          list="realm-continents"
          onChange={(e) => setNewContinent(e.target.value)}
          placeholder="Continent"
          aria-label="New continent"
          className="w-48"
        />
        <Button size="sm" variant="outline" disabled={!newKey.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
