"use client";

import React, { useState, useId } from "react";
import { useElement, useReadOnly, useEditorRef } from "platejs/react";
import { useTemplateSchema } from "../../hooks/useTemplateSchema";
import { parse } from "~/lib/wiki-os/wikitext/parser";
import { serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";

export interface PlateTemplateBlockProps {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
}

export function PlateInteractiveTemplateElement({ attributes, children }: PlateTemplateBlockProps) {
  const element = useElement() as any;
  const editor = useEditorRef();
  const readOnly = useReadOnly();

  const [activeTab, setActiveTab] = useState<"form" | "preview" | "raw">("form");
  const fallbackId = useId();

  const templateName = element?.templateName || element?.name || "Template";
  const classification =
    element?.classification ||
    (templateName.toLowerCase().startsWith("infobox") ? "infobox" : "standard");
  const rawWikitext = element?.rawWikitext || element?.raw || serializeTemplateToWikitext(element);
  const params: Record<string, string> = element?.params || {};

  const { paramList, hasSchema, loading } = useTemplateSchema(templateName);

  // Update a single parameter value
  const handleParamChange = (key: string, value: string) => {
    if (readOnly) return;
    const nextParams = { ...params, [key]: value };
    const nextWikitext = serializeTemplateToWikitext({
      templateName,
      params: nextParams,
      positional: element?.positional,
    });

    const path = (editor as unknown as { findPath: (n: unknown) => number[] | null }).findPath(
      element
    );
    if (path) {
      (editor as unknown as { setNodes: (props: unknown, opts: unknown) => void }).setNodes(
        {
          params: nextParams,
          rawWikitext: nextWikitext,
        } as any,
        { at: path }
      );
    }
  };

  // Update entire raw wikitext slice
  const handleRawChange = (newWikitext: string) => {
    if (readOnly) return;
    const { ast } = parse(newWikitext);
    const parsedNode = ast.nodes[0] as any;

    const path = (editor as unknown as { findPath: (n: unknown) => number[] | null }).findPath(
      element
    );
    if (path) {
      (editor as unknown as { setNodes: (props: unknown, opts: unknown) => void }).setNodes(
        {
          templateName: parsedNode?.templateName || templateName,
          params: parsedNode?.params || params,
          rawWikitext: newWikitext,
          parseState: parsedNode?.parseState,
        } as any,
        { at: path }
      );
    }
  };

  // Delete this template block
  const handleDelete = () => {
    if (readOnly) return;
    const path = (editor as unknown as { findPath: (n: unknown) => number[] | null }).findPath(
      element
    );
    if (path) {
      (editor as unknown as { removeNodes: (opts: unknown) => void }).removeNodes({ at: path });
    }
  };

  // Compute keys to show in Form tab
  const schemaKeys = new Set(paramList.map((p) => p.key));
  const customParamKeys = Object.keys(params).filter((k) => !schemaKeys.has(k) && !/^\d+$/.test(k));

  return (
    <div {...attributes} className="my-4">
      {children}
      <div
        contentEditable={false}
        className="group border-border/60 bg-card/80 hover:border-border relative max-w-full overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm transition-all"
      >
        {/* Card Header & Controls */}
        <div className="border-border/40 bg-secondary/30 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="bg-wiki/15 text-wiki flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold">
              {classification === "infobox" ? "IB" : "T"}
            </span>
            <span className="text-foreground text-xs font-bold break-words">{templateName}</span>
            <span className="bg-secondary/80 text-muted-foreground rounded-full px-2 py-0.5 text-[9px] font-medium tracking-wider uppercase">
              {classification}
            </span>
            {element?.parseState === "incomplete" && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500">
                Incomplete
              </span>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1.5">
              {/* Tab Selector */}
              <div className="bg-secondary/60 flex rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                    activeTab === "form"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                    activeTab === "preview"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("raw")}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                    activeTab === "raw"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Wikitext
                </button>
              </div>

              {/* Remove Action */}
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500/20 active:scale-[0.98]"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Form Editing View */}
        {activeTab === "form" && (
          <div className="space-y-3 p-4">
            {loading && (
              <div className="text-muted-foreground text-xs">Loading template schema...</div>
            )}

            {/* Schema fields */}
            {hasSchema &&
              paramList.map(({ key, meta }) => {
                const val = params[key] ?? "";
                const inputId = `${fallbackId}-${key}`;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <label htmlFor={inputId} className="text-foreground font-semibold">
                        {meta.label || key}
                        {meta.required && <span className="ml-1 font-bold text-red-500">*</span>}
                      </label>
                      {meta.description && (
                        <span className="text-muted-foreground max-w-[60%] truncate text-[10px]">
                          {meta.description}
                        </span>
                      )}
                    </div>
                    {val.includes("\n") || meta.type === "content" ? (
                      <textarea
                        id={inputId}
                        rows={2}
                        disabled={readOnly}
                        value={val}
                        placeholder={meta.example || meta.default || `Enter ${key}...`}
                        onChange={(e) => handleParamChange(key, e.target.value)}
                        className="border-border/50 bg-background/50 text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                      />
                    ) : (
                      <input
                        id={inputId}
                        type="text"
                        disabled={readOnly}
                        value={val}
                        placeholder={meta.example || meta.default || `Enter ${key}...`}
                        onChange={(e) => handleParamChange(key, e.target.value)}
                        className="border-border/50 bg-background/50 text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}

            {/* Custom / Discovered fields */}
            {customParamKeys.length > 0 && (
              <div className="border-border/30 space-y-2 border-t pt-2">
                <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Additional Parameters
                </div>
                {customParamKeys.map((key) => {
                  const val = params[key] ?? "";
                  const inputId = `${fallbackId}-${key}`;
                  return (
                    <div key={key} className="space-y-1">
                      <label
                        htmlFor={inputId}
                        className="text-foreground text-[11px] font-semibold"
                      >
                        {key}
                      </label>
                      <input
                        id={inputId}
                        type="text"
                        disabled={readOnly}
                        value={val}
                        onChange={(e) => handleParamChange(key, e.target.value)}
                        className="border-border/50 bg-background/50 text-foreground focus:border-wiki/60 w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {!hasSchema && customParamKeys.length === 0 && (
              <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">
                No fields configured. Switch to the <strong>Wikitext</strong> tab to add parameters.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Visual Card Preview */}
        {activeTab === "preview" && (
          <div className="p-4">
            <div className="border-border/40 bg-secondary/10 rounded-xl border p-3">
              <div className="text-foreground border-border/30 mb-2 border-b pb-2 text-center text-xs font-bold">
                {params["name"] || params["title"] || templateName}
              </div>
              <div className="space-y-1.5 text-xs">
                {Object.entries(params).map(([k, v]) => {
                  if (/^\d+$/.test(k) || !v) return null;
                  return (
                    <div
                      key={k}
                      className="border-border/20 flex justify-between gap-2 border-b py-1 last:border-0"
                    >
                      <span className="text-muted-foreground w-1/3 font-medium break-words">
                        {k}
                      </span>
                      <span className="text-foreground w-2/3 text-right break-words">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Raw Wikitext Editor */}
        {activeTab === "raw" && (
          <div className="p-4">
            <textarea
              rows={Math.max(4, rawWikitext.split("\n").length + 1)}
              disabled={readOnly}
              value={rawWikitext}
              onChange={(e) => handleRawChange(e.target.value)}
              className="border-border/50 bg-background/80 text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 w-full rounded-xl border p-3 font-mono text-xs focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
