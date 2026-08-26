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
  const classification = element?.classification || (templateName.toLowerCase().startsWith("infobox") ? "infobox" : "standard");
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

    const path = (editor as unknown as { findPath: (n: unknown) => number[] | null }).findPath(element);
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

    const path = (editor as unknown as { findPath: (n: unknown) => number[] | null }).findPath(element);
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
    const path = (editor as unknown as { findPath: (n: unknown) => number[] | null }).findPath(element);
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
        className="group relative max-w-full overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm transition-all hover:border-border"
      >
        {/* Card Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-secondary/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-wiki/15 text-[11px] font-bold text-wiki">
              {classification === "infobox" ? "IB" : "T"}
            </span>
            <span className="text-xs font-bold text-foreground break-words">{templateName}</span>
            <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
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
              <div className="flex rounded-lg bg-secondary/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                    activeTab === "form" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                    activeTab === "preview" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("raw")}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                    activeTab === "raw" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
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
          <div className="p-4 space-y-3">
            {loading && <div className="text-xs text-muted-foreground">Loading template schema...</div>}

            {/* Schema fields */}
            {hasSchema &&
              paramList.map(({ key, meta }) => {
                const val = params[key] ?? "";
                const inputId = `${fallbackId}-${key}`;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <label htmlFor={inputId} className="font-semibold text-foreground">
                        {meta.label || key}
                        {meta.required && <span className="ml-1 text-red-500 font-bold">*</span>}
                      </label>
                      {meta.description && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
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
                        className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
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
              <div className="pt-2 border-t border-border/30 space-y-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Additional Parameters
                </div>
                {customParamKeys.map((key) => {
                  const val = params[key] ?? "";
                  const inputId = `${fallbackId}-${key}`;
                  return (
                    <div key={key} className="space-y-1">
                      <label htmlFor={inputId} className="text-[11px] font-semibold text-foreground">
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

            {!hasSchema && customParamKeys.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                No fields configured. Switch to the <strong>Wikitext</strong> tab to add parameters.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Visual Card Preview */}
        {activeTab === "preview" && (
          <div className="p-4">
            <div className="rounded-xl border border-border/40 bg-secondary/10 p-3">
              <div className="text-center font-bold text-xs text-foreground border-b border-border/30 pb-2 mb-2">
                {params["name"] || params["title"] || templateName}
              </div>
              <div className="space-y-1.5 text-xs">
                {Object.entries(params).map(([k, v]) => {
                  if (/^\d+$/.test(k) || !v) return null;
                  return (
                    <div key={k} className="flex justify-between gap-2 border-b border-border/20 py-1 last:border-0">
                      <span className="font-medium text-muted-foreground w-1/3 break-words">{k}</span>
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
              className="w-full rounded-xl border border-border/50 bg-background/80 p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
