"use client";

// src/app/labs/onoma/components/sections/EtymologySection.tsx
// Onoma Lab — Etymology Web Section

import { useState, useMemo } from "react";
import {
  GitFork,
  Network,
  Plus,
  Trash2,
  CornerDownRight,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { FacetMaterial } from "~/components/facet-ui";
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
      <div className="ml-4 border-l border-border/20 pl-4 mt-2">
        <div className="flex items-start gap-2 group">
          <div className="mt-1 flex items-center justify-center">
            {hasChildren ? (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground opacity-55" />
            )}
          </div>

          <div className="flex-1 p-2.5 rounded bg-secondary/5 border border-border/10 hover:border-violet-500/20 hover:bg-secondary/10 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-bold text-foreground">{node.word}</span>
                {node.ipa && <span className="text-[10px] text-muted-foreground ml-2">/{node.ipa}/</span>}
                <span className="ml-2 text-xs text-violet-400 font-medium px-1.5 py-0.5 rounded bg-violet-500/10 capitalize">
                  {node.derivationType}
                </span>
                {node.morphemeAdded && (
                  <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                    ({node.morphemeAdded})
                  </span>
                )}
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
                <button
                  onClick={() => setAddingToParentId(node.id)}
                  title="Add child derivation"
                  className="p-1 hover:bg-violet-500/20 text-violet-400 rounded cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteDerivMutation.mutate({ id: node.id })}
                  title="Delete derivation"
                  className="p-1 hover:bg-red-500/20 text-red-400 rounded cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{node.meaning}</p>
            {node.notes && <p className="text-[10px] text-muted-foreground/80 mt-1 italic border-t border-border/5 pt-1">{node.notes}</p>}
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
      {/* Header */}
      <div>
        <h2 className="text-foreground text-xl font-bold tracking-tight">Etymological Web</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Track word roots, prefixes/suffixes, semantic shifts, and construct a morphological derivation tree.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Roots & Creation */}
        <div className="lg:col-span-4 space-y-4">
          <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Network className="h-4 w-4 text-violet-500" />
              Roots Directory
            </h3>

            {rootsLoading ? (
              <div className="text-center py-4 text-xs text-muted-foreground">Loading roots...</div>
            ) : roots?.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground italic">
                No roots created yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                {roots?.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRootId(r.id);
                      setAddingToParentId(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex justify-between items-center ${
                      selectedRootId === r.id
                        ? "bg-violet-500/10 text-violet-400 border border-violet-500/30"
                        : "hover:bg-secondary/15 border border-transparent text-foreground"
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{r.root}</span>
                      {r.ipa && <span className="text-[10px] text-muted-foreground ml-2">/{r.ipa}/</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground italic truncate max-w-[120px]">
                      {r.meaning}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </FacetMaterial>

          {/* Add New Root Form */}
          <FacetMaterial material="satin" className="border border-border/20 p-4">
            <form onSubmit={handleCreateRoot} className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Create New Root Word
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Root Grapheme</label>
                  <input
                    type="text"
                    required
                    value={newRootWord}
                    onChange={(e) => setNewRootWord(e.target.value)}
                    placeholder="e.g. log-"
                    className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">IPA (Optional)</label>
                  <input
                    type="text"
                    value={newRootIpa}
                    onChange={(e) => setNewRootIpa(e.target.value)}
                    placeholder="e.g. lɔɡ"
                    className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground font-medium mb-1">English Meaning</label>
                <input
                  type="text"
                  required
                  value={newRootMeaning}
                  onChange={(e) => setNewRootMeaning(e.target.value)}
                  placeholder="e.g. word, reason, speech"
                  className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground font-medium mb-1">Historical Notes</label>
                <textarea
                  value={newRootNotes}
                  onChange={(e) => setNewRootNotes(e.target.value)}
                  placeholder="Cognates, sound shifts, Proto-Conlang origin..."
                  className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs h-12 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={createRootMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold py-1.5 rounded text-xs cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Root Word
              </button>
            </form>
          </FacetMaterial>
        </div>

        {/* Right Column: Tree & Derivation adding */}
        <div className="lg:col-span-8 space-y-4">
          {activeRoot ? (
            <div className="space-y-4">
              {/* Root Details Header */}
              <FacetMaterial material="satin" className="border border-violet-500/20 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-extrabold text-foreground flex items-baseline gap-2">
                      {activeRoot.root}
                      {activeRoot.ipa && (
                        <span className="text-xs text-muted-foreground font-normal">/{activeRoot.ipa}/</span>
                      )}
                    </h3>
                    <p className="text-sm text-violet-400 font-medium mt-0.5">{activeRoot.meaning}</p>
                    {activeRoot.notes && (
                      <p className="text-xs text-muted-foreground mt-2 max-w-xl whitespace-pre-line italic">
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
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-bold border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-2 py-1 rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Root
                  </button>
                </div>
              </FacetMaterial>

              {/* Derivations Tree Graph */}
              <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-4 relative min-h-[300px]">
                <div className="flex justify-between items-center pb-2 border-b border-border/10">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <GitFork className="h-4 w-4 text-violet-500Rotate" />
                    Derivation Tree Graph
                  </h4>
                  <button
                    onClick={() => setAddingToParentId(null)}
                    className="text-[10px] flex items-center gap-1 text-violet-400 hover:text-violet-300 font-bold border border-violet-500/20 bg-violet-500/5 px-2 py-1 rounded cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Direct Derivation
                  </button>
                </div>

                {derivLoading ? (
                  <div className="text-center py-12 text-xs text-muted-foreground">Loading tree...</div>
                ) : derivationTree.length === 0 ? (
                  <div className="text-center py-12 text-xs text-muted-foreground italic">
                    No derived terms yet. Use the buttons or form below to branch out.
                  </div>
                ) : (
                  <div className="space-y-2 select-none">
                    <div className="p-2 bg-violet-500/5 border border-violet-500/20 rounded inline-block">
                      <span className="font-bold text-violet-400">{activeRoot.root}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">/{activeRoot.ipa}/</span>
                      <span className="text-xs text-muted-foreground block">{activeRoot.meaning}</span>
                    </div>

                    <div className="pl-4 border-l border-violet-500/10 space-y-2">
                      {derivationTree.map((node) => (
                        <RenderNode key={node.id} node={node} />
                      ))}
                    </div>
                  </div>
                )}
              </FacetMaterial>

              {/* Form to Add Derivation */}
              <FacetMaterial material="satin" className="border border-border/20 p-4">
                <form onSubmit={handleAddDerivation} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Add Derivation
                    </h4>
                    <span className="text-[10px] text-muted-foreground font-medium bg-secondary/30 px-2 py-0.5 rounded">
                      Parent:{" "}
                      {addingToParentId
                        ? derivData?.derivations.find((d: any) => d.id === addingToParentId)?.word || "Unknown"
                        : `Root (${activeRoot.root})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-muted-foreground font-medium mb-1">Derived Grapheme</label>
                      <input
                        type="text"
                        required
                        value={newDerivWord}
                        onChange={(e) => setNewDerivWord(e.target.value)}
                        placeholder="e.g. biology"
                        className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground font-medium mb-1">IPA (Optional)</label>
                      <input
                        type="text"
                        value={newDerivIpa}
                        onChange={(e) => setNewDerivIpa(e.target.value)}
                        placeholder="e.g. baɪˈɒlədʒi"
                        className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground font-medium mb-1">Derivation Type</label>
                      <select
                        value={newDerivType}
                        onChange={(e) => setNewDerivType(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
                      >
                        <option value="prefix">Prefixation (Affix)</option>
                        <option value="suffix">Suffixation (Affix)</option>
                        <option value="compound">Compounding</option>
                        <option value="semantic-shift">Semantic Shift</option>
                        <option value="reduplication">Reduplication</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground font-medium mb-1">Morpheme (Optional)</label>
                      <input
                        type="text"
                        value={newDerivMorpheme}
                        onChange={(e) => setNewDerivMorpheme(e.target.value)}
                        placeholder="e.g. -ology"
                        className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-muted-foreground font-medium mb-1">English Meaning</label>
                      <input
                        type="text"
                        required
                        value={newDerivMeaning}
                        onChange={(e) => setNewDerivMeaning(e.target.value)}
                        placeholder="e.g. study of life"
                        className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground font-medium mb-1">Notes / Sound Shifts (Optional)</label>
                      <input
                        type="text"
                        value={newDerivNotes}
                        onChange={(e) => setNewDerivNotes(e.target.value)}
                        placeholder="e.g. assimilation of g + o"
                        className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    {addingToParentId && (
                      <button
                        type="button"
                        onClick={() => setAddingToParentId(null)}
                        className="border border-border/40 hover:bg-secondary/20 text-foreground text-xs px-4 py-1.5 rounded font-bold cursor-pointer"
                      >
                        Cancel Parent Link
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={addDerivMutation.isPending}
                      className="bg-violet-600 hover:bg-violet-700 text-white text-xs px-6 py-1.5 rounded font-bold cursor-pointer transition-all active:scale-95"
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
              className="h-full border border-border/20 flex flex-col items-center justify-center p-12 text-center"
            >
              <Network className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
              <h4 className="text-sm font-bold text-foreground">No Root Selected</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Select an etymology root word from the directory on the left or create a new one to begin building the derivation tree.
              </p>
            </FacetMaterial>
          )}
        </div>
      </div>
    </div>
  );
}
