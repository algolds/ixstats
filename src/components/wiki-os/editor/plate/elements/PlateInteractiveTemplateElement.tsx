"use client";

import React, { useState, useId } from "react";
import { useElement, usePath, useReadOnly, useEditorRef } from "platejs/react";
import { Transforms } from "slate";
import { api } from "~/trpc/react";
import { useTemplateSchema } from "../../hooks/useTemplateSchema";
import { parse } from "~/lib/wiki-os/wikitext/parser";
import { serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  EditPencil as EditIcon,
  Trash as TrashIcon,
  Plus as PlusIcon,
  Code as CodeIcon,
  Eye as EyeIcon,
  Page as FormIcon,
  Puzzle as TemplateIcon,
} from "iconoir-react";
import { soundEffects } from "~/lib/sound/cuelume";

export interface PlateTemplateBlockProps {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}

export function PlateInteractiveTemplateElement({ attributes, children }: PlateTemplateBlockProps) {
  const element = useElement() as any;
  const editor = useEditorRef();
  const path = usePath();
  const readOnly = useReadOnly();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "preview" | "raw">("form");
  const [newParamKey, setNewParamKey] = useState("");
  const [newParamVal, setNewParamVal] = useState("");
  const [showAddParam, setShowAddParam] = useState(false);
  const fallbackId = useId();

  const templateName = element?.templateName || element?.name || "Template";
  const classification =
    element?.classification ||
    (templateName.toLowerCase().startsWith("infobox") ? "infobox" : "standard");
  const rawWikitext = element?.rawWikitext || element?.raw || serializeTemplateToWikitext(element);
  const params: Record<string, string> = element?.params || {};

  const { paramList, hasSchema, loading } = useTemplateSchema(templateName);

  const previewQuery = api.wikios.getTemplatePreview.useQuery(
    { template: templateName, params },
    { enabled: isModalOpen && activeTab === "preview", staleTime: 30_000 }
  );

  // Update a single parameter value
  const handleParamChange = (key: string, value: string) => {
    if (readOnly || !path) return;
    const nextParams = { ...params, [key]: value };
    const nextWikitext = serializeTemplateToWikitext({
      templateName,
      params: nextParams,
      positional: element?.positional,
    });

    try {
      Transforms.setNodes(
        editor as any,
        {
          params: nextParams,
          rawWikitext: nextWikitext,
        } as any,
        { at: path }
      );
    } catch (e) {
      console.error("[PlateInteractiveTemplate] Failed to update param:", e);
    }
  };

  // Add a new custom parameter
  const handleAddParam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParamKey.trim() || readOnly) return;
    handleParamChange(newParamKey.trim(), newParamVal.trim());
    setNewParamKey("");
    setNewParamVal("");
    setShowAddParam(false);
  };

  // Update entire raw wikitext slice
  const handleRawChange = (newWikitext: string) => {
    if (readOnly || !path) return;
    const { ast } = parse(newWikitext);
    const parsedNode = ast.nodes[0] as any;

    try {
      Transforms.setNodes(
        editor as any,
        {
          templateName: parsedNode?.templateName || templateName,
          params: parsedNode?.params || params,
          rawWikitext: newWikitext,
          parseState: parsedNode?.parseState,
        } as any,
        { at: path }
      );
    } catch (e) {
      console.error("[PlateInteractiveTemplate] Failed to update raw wikitext:", e);
    }
  };

  // Delete this template block
  const handleDelete = () => {
    if (readOnly || !path) return;
    try {
      Transforms.removeNodes(editor as any, { at: path });
    } catch (e) {
      console.error("[PlateInteractiveTemplate] Failed to remove template:", e);
    }
    setIsModalOpen(false);
  };

  // Compute keys to show in Form tab
  const schemaKeys = new Set(paramList.map((p) => p.key));
  const customParamKeys = Object.keys(params).filter((k) => !schemaKeys.has(k) && !/^\d+$/.test(k));

  // Extract representative preview snippet for the compact badge
  const previewValue =
    params["name"] ||
    params["title"] ||
    params["1"] ||
    Object.values(params).find((v) => v && !v.includes("\n") && v.length < 30) ||
    "";
  const configuredParamCount = Object.keys(params).filter((k) => params[k]?.trim()).length;

  return (
    <div {...attributes} className="my-2 select-none">
      {/* Hidden children for Slate document invariants */}
      <span className="hidden">{children}</span>

      {/* ─── Compact Space-Saving Inline/Block Badge ─── */}
      <div
        contentEditable={false}
        onDoubleClick={() => !readOnly && setIsModalOpen(true)}
        className="group relative flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/75 px-3 py-2 text-xs shadow-xs backdrop-blur-xs transition-all hover:border-wiki/50 hover:bg-card/95"
      >
        {/* Left: Icon, Template Name & Summary */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-6 items-center justify-center rounded-lg px-2 text-[10px] font-bold tracking-wider uppercase border shadow-xs ${
              classification === "infobox"
                ? "border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-400"
                : "border-wiki/30 bg-gradient-to-br from-wiki/20 to-cyan-500/10 text-wiki"
            }`}
          >
            {classification === "infobox" ? "IB" : "🧩"}
          </span>

          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-foreground text-xs">{templateName}</span>

            {previewValue && (
              <span className="truncate rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/40 max-w-[180px] sm:max-w-[260px]">
                {previewValue}
              </span>
            )}

            <span className="hidden sm:inline-block rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground/80">
              {configuredParamCount} {configuredParamCount === 1 ? "param" : "params"}
            </span>

            {element?.parseState === "incomplete" && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500 border border-amber-500/30">
                Incomplete
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!readOnly && (
            <>
              <button
                type="button"
                data-cuelume-press="droplet"
                onClick={() => {
                  soundEffects.bloom();
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1 rounded-lg bg-wiki/10 px-2.5 py-1 text-[11px] font-semibold text-wiki hover:bg-wiki/20 active:scale-[0.97] transition-all cursor-pointer shadow-xs"
                title="Edit template parameters"
              >
                <EditIcon className="h-3 w-3" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                data-cuelume-press="droplet"
                onClick={handleDelete}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 active:scale-[0.97] transition-all cursor-pointer"
                title="Remove template"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Dedicated Apple-Design Dialog Modal ─── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl">
          {/* Header */}
          <DialogHeader className="p-5 border-b border-border/40 pb-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                    classification === "infobox"
                      ? "border border-amber-500/30 bg-amber-500/20 text-amber-500"
                      : "border border-wiki/30 bg-wiki/20 text-wiki"
                  }`}
                >
                  {classification === "infobox" ? "IB" : <TemplateIcon className="h-4 w-4" />}
                </span>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    {templateName}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Configure parameters, verify live MediaWiki expansion, or inspect wikitext.
                  </DialogDescription>
                </div>
              </div>

              {/* Modal Tabs */}
              <div className="flex items-center rounded-lg bg-secondary/80 p-0.5 border border-border/40">
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeTab === "form"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FormIcon className="h-3 w-3" />
                  <span>Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeTab === "preview"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <EyeIcon className="h-3 w-3" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("raw")}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeTab === "raw"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CodeIcon className="h-3 w-3" />
                  <span>Wikitext</span>
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Tab 1: Form View */}
            {activeTab === "form" && (
              <div className="space-y-4">
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-wiki border-t-transparent" />
                    <span>Loading template schema...</span>
                  </div>
                )}

                {/* Schema fields */}
                {hasSchema &&
                  paramList.map(({ key, meta }) => {
                    const val = params[key] ?? "";
                    const inputId = `${fallbackId}-${key}`;
                    const isMultiline = val.includes("\n") || meta.type === "content";

                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <label htmlFor={inputId} className="font-semibold text-foreground">
                            {meta.label || key}
                            {meta.required && <span className="ml-1 font-bold text-red-500">*</span>}
                          </label>
                          {meta.description && (
                            <span className="max-w-[60%] truncate text-[11px] text-muted-foreground">
                              {meta.description}
                            </span>
                          )}
                        </div>

                        {isMultiline ? (
                          <textarea
                            id={inputId}
                            rows={3}
                            disabled={readOnly}
                            value={val}
                            placeholder={meta.example || meta.default || `Enter ${key}...`}
                            onChange={(e) => handleParamChange(key, e.target.value)}
                            className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                          />
                        ) : (
                          <input
                            id={inputId}
                            type="text"
                            disabled={readOnly}
                            value={val}
                            placeholder={meta.example || meta.default || `Enter ${key}...`}
                            onChange={(e) => handleParamChange(key, e.target.value)}
                            className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                          />
                        )}
                      </div>
                    );
                  })}

                {/* Custom / Discovered fields */}
                {customParamKeys.length > 0 && (
                  <div className="space-y-3 border-t border-border/30 pt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Additional Parameters
                    </div>
                    {customParamKeys.map((key) => {
                      const val = params[key] ?? "";
                      const inputId = `${fallbackId}-${key}`;
                      return (
                        <div key={key} className="space-y-1">
                          <label
                            htmlFor={inputId}
                            className="text-xs font-semibold text-foreground"
                          >
                            {key}
                          </label>
                          <input
                            id={inputId}
                            type="text"
                            disabled={readOnly}
                            value={val}
                            onChange={(e) => handleParamChange(key, e.target.value)}
                            className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-wiki/60 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add parameter button */}
                {!readOnly && (
                  <div className="border-t border-border/30 pt-3">
                    {showAddParam ? (
                      <form onSubmit={handleAddParam} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Param name"
                          value={newParamKey}
                          onChange={(e) => setNewParamKey(e.target.value)}
                          className="w-1/3 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-foreground focus:border-wiki/60 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Param value"
                          value={newParamVal}
                          onChange={(e) => setNewParamVal(e.target.value)}
                          className="flex-1 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-foreground focus:border-wiki/60 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-wiki px-3 py-1.5 text-xs font-semibold text-white hover:bg-wiki/90 active:scale-[0.97] transition-all"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddParam(false)}
                          className="rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddParam(true)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-wiki hover:underline cursor-pointer"
                      >
                        <PlusIcon className="h-3 w-3" />
                        <span>Add custom parameter</span>
                      </button>
                    )}
                  </div>
                )}

                {!hasSchema && customParamKeys.length === 0 && !showAddParam && (
                  <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                    No parameters configured yet. Click <strong>Add custom parameter</strong> or switch to the <strong>Wikitext</strong> tab.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Live MediaWiki Preview View */}
            {activeTab === "preview" && (
              <div>
                {previewQuery.isLoading ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-secondary/10 p-10 text-center text-muted-foreground">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-wiki border-t-transparent" />
                    <span className="text-xs">Rendering live MediaWiki preview...</span>
                  </div>
                ) : previewQuery.data ? (
                  <div className="overflow-x-auto rounded-xl border border-border/40 bg-card p-4 shadow-sm">
                    <div
                      className="wikios-article-body text-xs"
                      dangerouslySetInnerHTML={{ __html: previewQuery.data }}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
                    <div className="mb-2 border-b border-border/30 pb-2 text-center text-xs font-bold text-foreground">
                      {params["name"] || params["title"] || templateName}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {Object.entries(params).map(([k, v]) => {
                        if (/^\d+$/.test(k) || !v) return null;
                        return (
                          <div
                            key={k}
                            className="flex justify-between gap-2 border-b border-border/20 py-1 last:border-0"
                          >
                            <span className="w-1/3 font-medium break-words text-muted-foreground">
                              {k}
                            </span>
                            <span className="w-2/3 text-right break-words text-foreground">{v}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Raw Wikitext Code View */}
            {activeTab === "raw" && (
              <div>
                <textarea
                  rows={Math.max(6, rawWikitext.split("\n").length + 2)}
                  disabled={readOnly}
                  value={rawWikitext}
                  onChange={(e) => handleRawChange(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-muted/30 p-3.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                  placeholder="{{TemplateName|param=value}}"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Direct edits to raw wikitext synchronize immediately with visual form fields.
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="p-4 border-t border-border/40 bg-muted/20 flex items-center justify-between sm:justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 active:scale-[0.97] transition-all cursor-pointer"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              <span>Remove Template</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                data-cuelume-press="droplet"
                onClick={() => {
                  soundEffects.bloom();
                  setIsModalOpen(false);
                }}
                className="rounded-lg bg-wiki px-4 py-1.5 text-xs font-bold text-white hover:bg-wiki/90 active:scale-[0.97] transition-all cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
