"use client";

// src/app/labs/onoma/components/sections/EtymologySection.tsx
// Onoma Lab — Etymology Web Section

import { useState, useMemo } from "react";
import {
  GitFork,
  Network,
  Plus,
  Trash as Trash2,
  CornerBottomRight as CornerDownRight,
  NavArrowRight as ChevronRight,
  NavArrowDown as ChevronDown,
} from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface DerivationNode {
  id: string;
  rootId: string;
  parentId: string | null;
  word: string;
  meaning: string;
  ipa: string | null;
  derivationType: string;
  morphemeAdded: string | null;
  notes: string | null;
  createdAt: Date;
  children: DerivationNode[];
}

export default function EtymologySection() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Selected root state
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null);

  // Form states: New Root
  const [newRootWord, setNewRootWord] = useState("");
  const [newRootMeaning, setNewRootMeaning] = useState("");
  const [newRootIpa, setNewRootIpa] = useState("");
  const [newRootNotes, setNewRootNotes] = useState("");

  // Form states: New Derivation
  const [addingToParentId, setAddingToParentId] = useState<string | null>(null); // null means adding directly under root
  const [newDerivWord, setNewDerivWord] = useState("");
  const [newDerivMeaning, setNewDerivMeaning] = useState("");
  const [newDerivIpa, setNewDerivIpa] = useState("");
  const [newDerivType, setNewDerivType] = useState("prefix");
  const [newDerivMorpheme, setNewDerivMorpheme] = useState("");
  const [newDerivNotes, setNewDerivNotes] = useState("");

  // Queries
  const { data: roots, isLoading: rootsLoading } = api.onoma.listRoots.useQuery();
  const { data: derivData, isLoading: derivLoading } = api.onoma.getDerivations.useQuery(
    { rootId: selectedRootId || "" },
    { enabled: !!selectedRootId }
  );

  // Mutations
  const createRootMutation = api.onoma.createRoot.useMutation({
    onSuccess: (data: any) => {
      notify.success(`Root word '${data.root}' created.`);
      setNewRootWord("");
      setNewRootMeaning("");
      setNewRootIpa("");
      setNewRootNotes("");
      setSelectedRootId(data.id);
      void utils.onoma.listRoots.invalidate();
    },
    onError: (err: any) => {
      notify.error(`Failed to create root: ${err.message}`);
    },
  });

  const deleteRootMutation = api.onoma.deleteRoot.useMutation({
    onSuccess: () => {
      notify.success("Etymology root deleted.");
      setSelectedRootId(null);
      void utils.onoma.listRoots.invalidate();
    },
    onError: (err: any) => {
      notify.error(`Failed to delete root: ${err.message}`);
    },
  });

  const addDerivMutation = api.onoma.addDerivation.useMutation({
    onSuccess: () => {
      notify.success(`Derivation created successfully.`);
      setNewDerivWord("");
      setNewDerivMeaning("");
      setNewDerivIpa("");
      setNewDerivMorpheme("");
      setNewDerivNotes("");
      setAddingToParentId(null);
      if (selectedRootId) {
        void utils.onoma.getDerivations.invalidate({ rootId: selectedRootId });
      }
    },
    onError: (err: any) => {
      notify.error(`Failed to add derivation: ${err.message}`);
    },
  });

  const deleteDerivMutation = api.onoma.deleteDerivation.useMutation({
    onSuccess: () => {
      notify.success("Derivation deleted.");
      if (selectedRootId) {
        void utils.onoma.getDerivations.invalidate({ rootId: selectedRootId });
      }
    },
    onError: (err: any) => {
      notify.error(`Failed to delete derivation: ${err.message}`);
    },
  });

  // Build hierarchy tree from flat list of derivations
  const derivationTree = useMemo(() => {
    if (!derivData?.derivations) return [];

    const list = derivData.derivations.map((d: any) => ({
      ...d,
      children: [] as DerivationNode[],
    })) as DerivationNode[];

    const map = new Map<string, DerivationNode>();
    list.forEach((node) => map.set(node.id, node));

    // oxlint-disable-next-line eslint/no-shadow -- shadowed 'roots' is intentional in this scope
    const roots: DerivationNode[] = [];
    list.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [derivData]);

  const activeRoot = useMemo(() => {
    if (!selectedRootId || !roots) return null;
    return roots.find((r: any) => r.id === selectedRootId) || null;
  }, [selectedRootId, roots]);

  // Handle Root Submit
  const handleCreateRoot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRootWord || !newRootMeaning) return;
    createRootMutation.mutate({
      root: newRootWord,
      meaning: newRootMeaning,
      ipa: newRootIpa || undefined,
      notes: newRootNotes || undefined,
    });
  };

  // Handle Derivation Submit
  const handleAddDerivation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRootId || !newDerivWord || !newDerivMeaning) return;
    addDerivMutation.mutate({
      rootId: selectedRootId,
      parentId: addingToParentId || undefined,
      word: newDerivWord,
      meaning: newDerivMeaning,
      ipa: newDerivIpa || undefined,
      derivationType: newDerivType,
      morphemeAdded: newDerivMorpheme || undefined,
      notes: newDerivNotes || undefined,
    });
  };

  // Recursive component to render tree nodes
  const RenderNode = ({ node, depth = 1 }: { node: DerivationNode; depth?: number }) => {
    const [isOpen, setIsOpen] = useState(true);
    const hasChildren = node.children.length > 0;

    return (
      <div className="border-border/20 mt-2 ml-4 border-l pl-4">
        <div className="group flex items-start gap-2">
          <div className="mt-1 flex items-center justify-center">
            {hasChildren ? (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <CornerDownRight className="text-muted-foreground h-3.5 w-3.5 opacity-55" />
            )}
          </div>

          <div className="bg-secondary/5 border-border/10 hover:bg-secondary/10 flex-1 rounded border p-2.5 transition-colors hover:border-violet-500/20">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-foreground font-bold">{node.word}</span>
                {node.ipa && (
                  <span className="text-muted-foreground ml-2 text-[10px]">/{node.ipa}/</span>
                )}
                <span className="ml-2 rounded bg-violet-500/10 px-1.5 py-0.5 text-xs font-medium text-violet-400 capitalize">
                  {node.derivationType}
                </span>
                {node.morphemeAdded && (
                  <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                    ({node.morphemeAdded})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => setAddingToParentId(node.id)}
                  title="Add child derivation"
                  className="cursor-pointer rounded p-1 text-violet-400 hover:bg-violet-500/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteDerivMutation.mutate({ id: node.id })}
                  title="Delete derivation"
                  className="cursor-pointer rounded p-1 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">{node.meaning}</p>
            {node.notes && (
              <p className="text-muted-foreground/80 border-border/5 mt-1 border-t pt-1 text-[10px] italic">
                {node.notes}
              </p>
            )}
          </div>
        </div>

        {isOpen && hasChildren && (
          <div className="space-y-1">
            {node.children.map((child) => (
              <RenderNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Roots & Creation */}
        <div className="space-y-4 lg:col-span-4">
          <FacetMaterial material="satin" className="border-border/20 space-y-4 border p-4">
            <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Network className="h-4 w-4 text-violet-500" />
              Roots Directory
            </h3>

            {rootsLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading roots...</div>
            ) : roots?.length === 0 ? (
              <div className="border-border/40 bg-secondary/5 space-y-2 rounded-xl border border-dashed p-5 text-center text-xs">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10 text-violet-400">
                  <GitFork className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-foreground font-semibold">No Proto-Roots Yet</p>
                  <p className="text-muted-foreground text-[11px] leading-normal">
                    Create your first root word below to start branching derivations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-h-60 scrollbar-thin space-y-1.5 overflow-y-auto pr-1">
                {roots?.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRootId(r.id);
                      setAddingToParentId(null);
                    }}
                    className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs transition-colors ${
                      selectedRootId === r.id
                        ? "border border-violet-500/30 bg-violet-500/10 text-violet-400"
                        : "hover:bg-secondary/15 text-foreground border border-transparent"
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{r.root}</span>
                      {r.ipa && (
                        <span className="text-muted-foreground ml-2 text-[10px]">/{r.ipa}/</span>
                      )}
                    </div>
                    <span className="text-muted-foreground max-w-[120px] truncate text-[10px] italic">
                      {r.meaning}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </FacetMaterial>

          {/* Add New Root Form */}
          <FacetMaterial material="satin" className="border-border/20 border p-4">
            <form onSubmit={handleCreateRoot} className="space-y-3">
              <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                Create New Root Word
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                    Root Grapheme
                  </label>
                  <input
                    type="text"
                    required
                    value={newRootWord}
                    onChange={(e) => setNewRootWord(e.target.value)}
                    placeholder="e.g. log-"
                    className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:border-violet-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                    IPA (Optional)
                  </label>
                  <input
                    type="text"
                    value={newRootIpa}
                    onChange={(e) => setNewRootIpa(e.target.value)}
                    placeholder="e.g. lɔɡ"
                    className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:border-violet-500/50 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                  English Meaning
                </label>
                <input
                  type="text"
                  required
                  value={newRootMeaning}
                  onChange={(e) => setNewRootMeaning(e.target.value)}
                  placeholder="e.g. word, reason, speech"
                  className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:border-violet-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                  Historical Notes
                </label>
                <textarea
                  value={newRootNotes}
                  onChange={(e) => setNewRootNotes(e.target.value)}
                  placeholder="Cognates, sound shifts, Proto-Conlang origin..."
                  className="bg-background/50 border-border/40 text-foreground h-12 w-full rounded border px-2 py-1 text-xs focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={createRootMutation.isPending}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded bg-violet-600 py-1.5 text-xs font-bold text-white transition-all hover:bg-violet-700 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Root Word
              </button>
            </form>
          </FacetMaterial>
        </div>

        {/* Right Column: Tree & Derivation adding */}
        <div className="space-y-4 lg:col-span-8">
          {activeRoot ? (
            <div className="space-y-4">
              {/* Root Details Header */}
              <FacetMaterial material="satin" className="border border-violet-500/20 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-foreground flex items-baseline gap-2 text-lg font-extrabold">
                      {activeRoot.root}
                      {activeRoot.ipa && (
                        <span className="text-muted-foreground text-xs font-normal">
                          /{activeRoot.ipa}/
                        </span>
                      )}
                    </h3>
                    <p className="mt-0.5 text-sm font-medium text-violet-400">
                      {activeRoot.meaning}
                    </p>
                    {activeRoot.notes && (
                      <p className="text-muted-foreground mt-2 max-w-xl text-xs whitespace-pre-line italic">
                        {activeRoot.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Delete this root and all its derivations?")) {
                        deleteRootMutation.mutate({ id: activeRoot.id });
                      }
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded border border-red-500/20 bg-red-500/5 px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Root
                  </button>
                </div>
              </FacetMaterial>

              {/* Derivations Tree Graph */}
              <FacetMaterial
                material="satin"
                className="border-border/20 relative min-h-[300px] space-y-4 border p-4"
              >
                <div className="border-border/10 flex items-center justify-between border-b pb-2">
                  <h4 className="text-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                    <GitFork className="text-violet-500Rotate h-4 w-4" />
                    Derivation Tree Graph
                  </h4>
                  <button
                    onClick={() => setAddingToParentId(null)}
                    className="flex cursor-pointer items-center gap-1 rounded border border-violet-500/20 bg-violet-500/5 px-2 py-1 text-[10px] font-bold text-violet-400 hover:text-violet-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Direct Derivation
                  </button>
                </div>

                {derivLoading ? (
                  <div className="text-muted-foreground py-12 text-center text-xs">
                    Loading tree...
                  </div>
                ) : derivationTree.length === 0 ? (
                  <div className="text-muted-foreground py-12 text-center text-xs italic">
                    No derived terms yet. Use the buttons or form below to branch out.
                  </div>
                ) : (
                  <div className="space-y-2 select-none">
                    <div className="inline-block rounded border border-violet-500/20 bg-violet-500/5 p-2">
                      <span className="font-bold text-violet-400">{activeRoot.root}</span>
                      <span className="text-muted-foreground ml-2 text-[10px]">
                        /{activeRoot.ipa}/
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {activeRoot.meaning}
                      </span>
                    </div>

                    <div className="space-y-2 border-l border-violet-500/10 pl-4">
                      {derivationTree.map((node) => (
                        <RenderNode key={node.id} node={node} />
                      ))}
                    </div>
                  </div>
                )}
              </FacetMaterial>

              {/* Form to Add Derivation */}
              <FacetMaterial material="satin" className="border-border/20 border p-4">
                <form onSubmit={handleAddDerivation} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                      Add Derivation
                    </h4>
                    <span className="text-muted-foreground bg-secondary/30 rounded px-2 py-0.5 text-[10px] font-medium">
                      Parent:{" "}
                      {addingToParentId
                        ? derivData?.derivations.find((d: any) => d.id === addingToParentId)
                            ?.word || "Unknown"
                        : `Root (${activeRoot.root})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                        Derived Grapheme
                      </label>
                      <input
                        type="text"
                        required
                        value={newDerivWord}
                        onChange={(e) => setNewDerivWord(e.target.value)}
                        placeholder="e.g. biology"
                        className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:border-violet-500/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                        IPA (Optional)
                      </label>
                      <input
                        type="text"
                        value={newDerivIpa}
                        onChange={(e) => setNewDerivIpa(e.target.value)}
                        placeholder="e.g. baɪˈɒlədʒi"
                        className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:border-violet-500/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                        Derivation Type
                      </label>
                      <select
                        value={newDerivType}
                        onChange={(e) => setNewDerivType(e.target.value)}
                        className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:outline-none"
                      >
                        <option value="prefix">Prefixation (Affix)</option>
                        <option value="suffix">Suffixation (Affix)</option>
                        <option value="compound">Compounding</option>
                        <option value="semantic-shift">Semantic Shift</option>
                        <option value="reduplication">Reduplication</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                        Morpheme (Optional)
                      </label>
                      <input
                        type="text"
                        value={newDerivMorpheme}
                        onChange={(e) => setNewDerivMorpheme(e.target.value)}
                        placeholder="e.g. -ology"
                        className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:border-violet-500/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                        English Meaning
                      </label>
                      <input
                        type="text"
                        required
                        value={newDerivMeaning}
                        onChange={(e) => setNewDerivMeaning(e.target.value)}
                        placeholder="e.g. study of life"
                        className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                        Notes / Sound Shifts (Optional)
                      </label>
                      <input
                        type="text"
                        value={newDerivNotes}
                        onChange={(e) => setNewDerivNotes(e.target.value)}
                        placeholder="e.g. assimilation of g + o"
                        className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    {addingToParentId && (
                      <button
                        type="button"
                        onClick={() => setAddingToParentId(null)}
                        className="border-border/40 hover:bg-secondary/20 text-foreground cursor-pointer rounded border px-4 py-1.5 text-xs font-bold"
                      >
                        Cancel Parent Link
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={addDerivMutation.isPending}
                      className="cursor-pointer rounded bg-violet-600 px-6 py-1.5 text-xs font-bold text-white transition-all hover:bg-violet-700 active:scale-95"
                    >
                      Create Derivation
                    </button>
                  </div>
                </form>
              </FacetMaterial>
            </div>
          ) : (
            <FacetMaterial
              material="satin"
              className="border-border/20 h-full min-h-[460px] border"
            >
              <div className="flex h-full min-h-[460px] w-full flex-col items-center justify-center space-y-3 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 shadow-lg shadow-violet-500/5">
                  <Network className="h-7 w-7 text-violet-400" />
                </div>
                <div className="max-w-sm space-y-1">
                  <h4 className="text-foreground text-sm font-bold tracking-tight">
                    Select or Create a Root
                  </h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Pick an etymology root word from the directory on the left to inspect its
                    morphological family tree, or create a new proto-root to begin branching
                    derivations.
                  </p>
                </div>
                {roots && roots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedRootId(roots[0].id)}
                    className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-400 transition-all hover:bg-violet-500/20 active:scale-95"
                  >
                    <span>Open &quot;{roots[0].root}&quot; Tree</span>
                  </button>
                )}
              </div>
            </FacetMaterial>
          )}
        </div>
      </div>
    </div>
  );
}
