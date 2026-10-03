"use client";

import { cn } from "~/lib/utils";
import { SegmentedControl } from "~/components/ui/segmented-control";
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
import { Button } from "~/components/ui/button";

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
        className="group rounded-row border-separator bg-surface text-footnote hover:border-tint/50 hover:bg-surface relative flex items-center justify-between gap-3 border px-3 py-2 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
      >
        {/* Left: Icon, Template Name & Summary */}
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "rounded-control text-caption flex h-6 items-center justify-center border px-2",
              classification === "infobox"
                ? "border-yellow/30 bg-yellow/15 text-yellow"
                : "border-tint/30 bg-tint-fill text-tint"
            )}
          >
            {classification === "infobox" ? "IB" : "🧩"}
          </span>

          <div className="flex items-center gap-2 truncate">
            <span className="text-label text-caption font-semibold">{templateName}</span>

            {previewValue && (
              <span className="rounded-control-sm bg-fill-2 text-caption text-label-secondary border-separator max-w-[180px] truncate border px-2 py-0.5 sm:max-w-[260px]">
                {previewValue}
              </span>
            )}

            <span className="bg-fill-3 text-footnote text-label-secondary hidden rounded-full px-2 py-0.5 tabular-nums sm:inline-block">
              {configuredParamCount} {configuredParamCount === 1 ? "param" : "params"}
            </span>

            {element?.parseState === "incomplete" && (
              <span className="bg-yellow/10 text-caption text-yellow border-yellow/30 rounded-full border px-2 py-0.5 font-semibold">
                Incomplete
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {!readOnly && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsModalOpen(true);
                }}
                title="Edit template parameters"
              >
                <EditIcon className="h-3 w-3" />
                <span>Edit</span>
              </Button>

              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove template"
                onClick={handleDelete}
                title="Remove template"
                className="text-label-secondary hover:bg-red/10 hover:text-red"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ─── Dialog ─── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-surface border-separator shadow-floating rounded-card flex max-h-[85vh] max-w-2xl flex-col overflow-hidden border p-0">
          {/* Header */}
          <DialogHeader className="border-separator border-b p-5 pb-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-control text-caption flex h-7 w-7 items-center justify-center font-semibold",
                    classification === "infobox"
                      ? "border-yellow/30 bg-yellow/20 text-yellow border"
                      : "border-tint/30 bg-tint/20 text-tint border"
                  )}
                >
                  {classification === "infobox" ? "IB" : <TemplateIcon className="h-4 w-4" />}
                </span>
                <div>
                  <DialogTitle className="text-title-3 text-label">{templateName}</DialogTitle>
                  <DialogDescription className="text-footnote text-label-secondary">
                    Configure parameters, verify live MediaWiki expansion, or inspect wikitext.
                  </DialogDescription>
                </div>
              </div>

              {/* Modal Tabs */}
              <SegmentedControl
                asTabs
                aria-label="Template editor view"
                size="sm"
                value={activeTab}
                onValueChange={setActiveTab}
                options={[
                  { value: "form", label: "Form", icon: <FormIcon aria-hidden="true" /> },
                  { value: "preview", label: "Preview", icon: <EyeIcon aria-hidden="true" /> },
                  { value: "raw", label: "Wikitext", icon: <CodeIcon aria-hidden="true" /> },
                ]}
              />
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Tab 1: Form View */}
            {activeTab === "form" && (
              <div className="space-y-4">
                {loading && (
                  <div className="text-footnote text-label-secondary flex items-center gap-2">
                    <div className="border-tint h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" />
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
                        <div className="text-footnote flex items-center justify-between">
                          <label htmlFor={inputId} className="text-label font-semibold">
                            {meta.label || key}
                            {meta.required && (
                              <span className="text-red ml-1 font-semibold">*</span>
                            )}
                          </label>
                          {meta.description && (
                            <span className="text-footnote text-label-secondary max-w-[60%] truncate">
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
                            className="rounded-control border-separator bg-surface text-footnote text-label placeholder:text-label-tertiary focus:border-tint/60 w-full border px-3 py-2 focus:outline-none"
                          />
                        ) : (
                          <input
                            id={inputId}
                            type="text"
                            disabled={readOnly}
                            value={val}
                            placeholder={meta.example || meta.default || `Enter ${key}...`}
                            onChange={(e) => handleParamChange(key, e.target.value)}
                            className="rounded-control border-separator bg-surface text-footnote text-label placeholder:text-label-tertiary focus:border-tint/60 w-full border px-3 py-2 focus:outline-none"
                          />
                        )}
                      </div>
                    );
                  })}

                {/* Custom / Discovered fields */}
                {customParamKeys.length > 0 && (
                  <div className="border-separator space-y-3 border-t pt-3">
                    <div className="text-eyebrow text-label-secondary">Additional parameters</div>
                    {customParamKeys.map((key) => {
                      const val = params[key] ?? "";
                      const inputId = `${fallbackId}-${key}`;
                      return (
                        <div key={key} className="space-y-1">
                          <label
                            htmlFor={inputId}
                            className="text-caption text-label font-semibold"
                          >
                            {key}
                          </label>
                          <input
                            id={inputId}
                            type="text"
                            disabled={readOnly}
                            value={val}
                            onChange={(e) => handleParamChange(key, e.target.value)}
                            className="rounded-control border-separator bg-surface text-footnote text-label focus:border-tint/60 w-full border px-3 py-2 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add parameter button */}
                {!readOnly && (
                  <div className="border-separator border-t pt-3">
                    {showAddParam ? (
                      <form onSubmit={handleAddParam} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Param name"
                          value={newParamKey}
                          onChange={(e) => setNewParamKey(e.target.value)}
                          className="rounded-control border-separator bg-surface text-footnote text-label focus:border-tint/60 w-1/3 border px-3 py-2 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Param value"
                          value={newParamVal}
                          onChange={(e) => setNewParamVal(e.target.value)}
                          className="rounded-control border-separator bg-surface text-footnote text-label focus:border-tint/60 flex-1 border px-3 py-2 focus:outline-none"
                        />
                        <Button size="sm" type="submit">
                          Add
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowAddParam(false)}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setShowAddParam(true)}
                        className="h-auto px-0"
                      >
                        <PlusIcon className="h-3 w-3" />
                        <span>Add custom parameter</span>
                      </Button>
                    )}
                  </div>
                )}

                {!hasSchema && customParamKeys.length === 0 && !showAddParam && (
                  <div className="rounded-row border-separator text-footnote text-label-secondary border border-dashed p-6 text-center">
                    No parameters configured yet. Click <strong>Add custom parameter</strong> or
                    switch to the <strong>Wikitext</strong> tab.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Live MediaWiki Preview View */}
            {activeTab === "preview" && (
              <div>
                {previewQuery.isLoading ? (
                  <div className="rounded-row border-separator bg-fill-4 text-label-secondary flex flex-col items-center justify-center gap-2 border p-10 text-center">
                    <div className="border-tint h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
                    <span className="text-footnote">Rendering live MediaWiki preview...</span>
                  </div>
                ) : previewQuery.data ? (
                  <div className="rounded-row border-separator bg-surface shadow-card overflow-x-auto border p-4">
                    <div
                      className="wikios-article-body text-footnote"
                      dangerouslySetInnerHTML={{ __html: previewQuery.data }}
                    />
                  </div>
                ) : (
                  <div className="rounded-row border-separator bg-fill-4 border p-4">
                    <div className="border-separator text-caption text-label mb-2 border-b pb-2 text-center font-semibold">
                      {params["name"] || params["title"] || templateName}
                    </div>
                    <div className="text-footnote space-y-2">
                      {Object.entries(params).map(([k, v]) => {
                        if (/^\d+$/.test(k) || !v) return null;
                        return (
                          <div
                            key={k}
                            className="border-separator flex justify-between gap-2 border-b py-1 last:border-0"
                          >
                            <span className="text-label-secondary w-1/3 font-medium break-words">
                              {k}
                            </span>
                            <span className="text-label w-2/3 text-right break-words">{v}</span>
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
                  className="rounded-row border-separator bg-fill-4 text-footnote text-label placeholder:text-label-tertiary focus:border-tint/60 w-full border p-4 tabular-nums focus:outline-none"
                  placeholder="{{TemplateName|param=value}}"
                />
                <p className="text-footnote text-label-secondary mt-2">
                  Direct edits to raw wikitext synchronize immediately with visual form fields.
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="border-separator bg-fill-4 flex items-center justify-between border-t p-4 sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-red hover:bg-red/10"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              <span>Remove template</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setIsModalOpen(false);
                }}
              >
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
