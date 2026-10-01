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
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { FacetCard } from "~/components/ui/facet-container";

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
      <div className="border-separator mt-2 ml-4 border-l pl-4">
        <div className="group flex items-start gap-2">
          <div className="mt-1 flex items-center justify-center">
            {hasChildren ? (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-label-secondary hover:text-label cursor-pointer"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <CornerDownRight className="text-label-secondary h-3.5 w-3.5 opacity-55" />
            )}
          </div>

          <div className="bg-fill-4 border-separator hover:bg-fill-4 rounded-control-sm hover:border-indigo/20 flex-1 border p-2.5 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-label font-semibold">{node.word}</span>
                {node.ipa && (
                  <span className="text-label-secondary text-caption ml-2">/{node.ipa}/</span>
                )}
                <span className="rounded-control-sm bg-indigo/10 text-footnote text-indigo ml-2 px-1.5 py-0.5 font-medium capitalize">
                  {node.derivationType}
                </span>
                {node.morphemeAdded && (
                  <span className="text-label-secondary text-caption ml-1 font-mono">
                    ({node.morphemeAdded})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => setAddingToParentId(node.id)}
                  title="Add child derivation"
                  className="rounded-control-sm text-indigo hover:bg-indigo/20 cursor-pointer p-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteDerivMutation.mutate({ id: node.id })}
                  title="Delete derivation"
                  className="rounded-control-sm text-red hover:bg-red/20 cursor-pointer p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-label-secondary text-footnote mt-0.5">{node.meaning}</p>
            {node.notes && (
              <p className="text-label-secondary border-separator text-caption mt-1 border-t pt-1 italic">
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
          <FacetCard variant="inset" padding="none" className="space-y-4 p-4">
            <h3 className="text-label text-body flex items-center gap-2 font-semibold">
              <Network className="text-indigo h-4 w-4" />
              Roots Directory
            </h3>

            {rootsLoading ? (
              <div className="text-label-secondary text-footnote py-8 text-center">
                Loading roots...
              </div>
            ) : roots?.length === 0 ? (
              <div className="border-separator bg-fill-4 rounded-row text-footnote space-y-2 border border-dashed p-5 text-center">
                <div className="bg-indigo/10 text-indigo mx-auto flex h-9 w-9 items-center justify-center rounded-full">
                  <GitFork className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-label font-semibold">No Proto-Roots Yet</p>
                  <p className="text-label-secondary text-caption leading-normal">
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
                    className={`rounded-control-sm text-footnote flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
                      selectedRootId === r.id
                        ? "border-indigo/30 bg-indigo/10 text-indigo border"
                        : "hover:bg-fill-4 text-label border border-transparent"
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{r.root}</span>
                      {r.ipa && (
                        <span className="text-label-secondary text-caption ml-2">/{r.ipa}/</span>
                      )}
                    </div>
                    <span className="text-label-secondary text-caption max-w-[120px] truncate italic">
                      {r.meaning}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </FacetCard>

          {/* Add New Root Form */}
          <FacetCard variant="inset" padding="none" className="p-4">
            <form onSubmit={handleCreateRoot} className="space-y-3">
              <h4 className="text-label text-subhead">Create New Root Word</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-label-secondary text-caption mb-1 block font-medium">
                    Root Grapheme
                  </label>
                  <Input
                    type="text"
                    required
                    value={newRootWord}
                    onChange={(e) => setNewRootWord(e.target.value)}
                    placeholder="e.g. log-"
                    className="text-footnote w-full"
                  />
                </div>
                <div>
                  <label className="text-label-secondary text-caption mb-1 block font-medium">
                    IPA (Optional)
                  </label>
                  <Input
                    type="text"
                    value={newRootIpa}
                    onChange={(e) => setNewRootIpa(e.target.value)}
                    placeholder="e.g. lɔɡ"
                    className="text-footnote w-full"
                  />
                </div>
              </div>
              <div>
                <label className="text-label-secondary text-caption mb-1 block font-medium">
                  English Meaning
                </label>
                <Input
                  type="text"
                  required
                  value={newRootMeaning}
                  onChange={(e) => setNewRootMeaning(e.target.value)}
                  placeholder="e.g. word, reason, speech"
                  className="text-footnote w-full"
                />
              </div>
              <div>
                <label className="text-label-secondary text-caption mb-1 block font-medium">
                  Historical Notes
                </label>
                <Textarea
                  value={newRootNotes}
                  onChange={(e) => setNewRootNotes(e.target.value)}
                  placeholder="Cognates, sound shifts, Proto-Conlang origin..."
                  className="text-footnote h-12 w-full"
                />
              </div>
              <button
                type="submit"
                disabled={createRootMutation.isPending}
                className="rounded-control-sm bg-indigo text-footnote text-on-indigo hover:bg-indigo flex w-full cursor-pointer items-center justify-center gap-1.5 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Root Word
              </button>
            </form>
          </FacetCard>
        </div>

        {/* Right Column: Tree & Derivation adding */}
        <div className="space-y-4 lg:col-span-8">
          {activeRoot ? (
            <div className="space-y-4">
              {/* Root Details Header */}
              <FacetCard variant="inset" padding="none" className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-label text-title-3 flex items-baseline gap-2 font-bold">
                      {activeRoot.root}
                      {activeRoot.ipa && (
                        <span className="text-label-secondary text-footnote font-normal">
                          /{activeRoot.ipa}/
                        </span>
                      )}
                    </h3>
                    <p className="text-body text-indigo mt-0.5 font-medium">{activeRoot.meaning}</p>
                    {activeRoot.notes && (
                      <p className="text-label-secondary text-footnote mt-2 max-w-xl whitespace-pre-line italic">
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
                    className="rounded-control-sm border-red/20 bg-red/5 text-footnote text-red hover:bg-red/10 hover:text-red flex cursor-pointer items-center gap-1 border px-2 py-1 font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Root
                  </button>
                </div>
              </FacetCard>

              {/* Derivations Tree Graph */}
              <FacetCard
                variant="inset"
                padding="none"
                className="relative min-h-[300px] space-y-4 p-4"
              >
                <div className="border-separator flex items-center justify-between border-b pb-2">
                  <h4 className="text-label text-subhead flex items-center gap-1.5">
                    <GitFork className="text-indigo h-4 w-4" />
                    Derivation Tree Graph
                  </h4>
                  <button
                    onClick={() => setAddingToParentId(null)}
                    className="rounded-control-sm border-indigo/20 bg-indigo/5 text-caption text-indigo hover:text-indigo flex cursor-pointer items-center gap-1 border px-2 py-1 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Direct Derivation
                  </button>
                </div>

                {derivLoading ? (
                  <div className="text-label-secondary text-footnote py-12 text-center">
                    Loading tree...
                  </div>
                ) : derivationTree.length === 0 ? (
                  <div className="text-label-secondary text-footnote py-12 text-center italic">
                    No derived terms yet. Use the buttons or form below to branch out.
                  </div>
                ) : (
                  <div className="space-y-2 select-none">
                    <div className="rounded-control-sm border-indigo/20 bg-indigo/5 inline-block border p-2">
                      <span className="text-indigo font-semibold">{activeRoot.root}</span>
                      <span className="text-label-secondary text-caption ml-2">
                        /{activeRoot.ipa}/
                      </span>
                      <span className="text-label-secondary text-footnote block">
                        {activeRoot.meaning}
                      </span>
                    </div>

                    <div className="border-indigo/10 space-y-2 border-l pl-4">
                      {derivationTree.map((node) => (
                        <RenderNode key={node.id} node={node} />
                      ))}
                    </div>
                  </div>
                )}
              </FacetCard>

              {/* Form to Add Derivation */}
              <FacetCard variant="inset" padding="none" className="p-4">
                <form onSubmit={handleAddDerivation} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-label text-subhead">Add Derivation</h4>
                    <span className="text-label-secondary bg-fill-3 rounded-control-sm text-caption px-2 py-0.5 font-medium">
                      Parent:{" "}
                      {addingToParentId
                        ? derivData?.derivations.find((d: any) => d.id === addingToParentId)
                            ?.word || "Unknown"
                        : `Root (${activeRoot.root})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <label className="text-label-secondary text-caption mb-1 block font-medium">
                        Derived Grapheme
                      </label>
                      <Input
                        type="text"
                        required
                        value={newDerivWord}
                        onChange={(e) => setNewDerivWord(e.target.value)}
                        placeholder="e.g. biology"
                        className="text-footnote w-full"
                      />
                    </div>
                    <div>
                      <label className="text-label-secondary text-caption mb-1 block font-medium">
                        IPA (Optional)
                      </label>
                      <Input
                        type="text"
                        value={newDerivIpa}
                        onChange={(e) => setNewDerivIpa(e.target.value)}
                        placeholder="e.g. baɪˈɒlədʒi"
                        className="text-footnote w-full"
                      />
                    </div>
                    <div>
                      <label className="text-label-secondary text-caption mb-1 block font-medium">
                        Derivation Type
                      </label>
                      <select
                        value={newDerivType}
                        onChange={(e) => setNewDerivType(e.target.value)}
                        className="border-separator bg-fill-3 text-label hover:bg-fill-2 focus-visible:outline-tint rounded-control-sm text-footnote h-(--control-height-sm) w-full border px-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        <option value="prefix">Prefixation (Affix)</option>
                        <option value="suffix">Suffixation (Affix)</option>
                        <option value="compound">Compounding</option>
                        <option value="semantic-shift">Semantic Shift</option>
                        <option value="reduplication">Reduplication</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-label-secondary text-caption mb-1 block font-medium">
                        Morpheme (Optional)
                      </label>
                      <Input
                        type="text"
                        value={newDerivMorpheme}
                        onChange={(e) => setNewDerivMorpheme(e.target.value)}
                        placeholder="e.g. -ology"
                        className="text-footnote w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-label-secondary text-caption mb-1 block font-medium">
                        English Meaning
                      </label>
                      <Input
                        type="text"
                        required
                        value={newDerivMeaning}
                        onChange={(e) => setNewDerivMeaning(e.target.value)}
                        placeholder="e.g. study of life"
                        className="text-footnote w-full"
                      />
                    </div>
                    <div>
                      <label className="text-label-secondary text-caption mb-1 block font-medium">
                        Notes / Sound Shifts (Optional)
                      </label>
                      <Input
                        type="text"
                        value={newDerivNotes}
                        onChange={(e) => setNewDerivNotes(e.target.value)}
                        placeholder="e.g. assimilation of g + o"
                        className="text-footnote w-full"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    {addingToParentId && (
                      <button
                        type="button"
                        onClick={() => setAddingToParentId(null)}
                        className="border-separator hover:bg-fill-4 text-label rounded-control-sm text-footnote cursor-pointer border px-4 py-1.5 font-semibold"
                      >
                        Cancel Parent Link
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={addDerivMutation.isPending}
                      className="rounded-control-sm bg-indigo text-footnote text-on-indigo hover:bg-indigo cursor-pointer px-6 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
                    >
                      Create Derivation
                    </button>
                  </div>
                </form>
              </FacetCard>
            </div>
          ) : (
            <FacetCard variant="inset" padding="none" className="h-full min-h-[460px]">
              <div className="flex h-full min-h-[460px] w-full flex-col items-center justify-center space-y-3 p-8 text-center">
                <div className="rounded-card border-indigo/20 bg-indigo/10 shadow-card flex h-14 w-14 items-center justify-center border">
                  <Network className="text-indigo h-7 w-7" />
                </div>
                <div className="max-w-sm space-y-1">
                  <h4 className="text-label text-body font-semibold">Select or Create a Root</h4>
                  <p className="text-label-secondary text-footnote leading-relaxed">
                    Pick an etymology root word from the directory on the left to inspect its
                    morphological family tree, or create a new proto-root to begin branching
                    derivations.
                  </p>
                </div>
                {roots && roots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedRootId(roots[0].id)}
                    className="rounded-control border-indigo/30 bg-indigo/10 text-footnote text-indigo hover:bg-indigo/20 mt-2 flex cursor-pointer items-center gap-1.5 border px-3.5 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
                  >
                    <span>Open &quot;{roots[0].root}&quot; Tree</span>
                  </button>
                )}
              </div>
            </FacetCard>
          )}
        </div>
      </div>
    </div>
  );
}
