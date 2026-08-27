// src/components/wiki-os/editor/components/WikiEditorModalHost.tsx
// Centralized modal host for WikiOS Visual and Source editors.

"use client";

import React, { useState } from "react";
import { Puzzle, Xmark as X } from "iconoir-react";
import { api } from "~/trpc/react";
import { ImageSearchModal } from "~/components/wiki-os/editor/ImageSearchModal";
import {
  InfoboxCountryModal,
  CountryStatsModal,
  BusinessStatsModal,
  MapCoordsModal,
} from "~/components/wiki-os/editor/WikiTemplateModals";
import { useEditorModalContext } from "../context/EditorModalContext";
import { useTemplateSchema } from "../hooks/useTemplateSchema";

export interface WikiEditorModalHostProps {
  onInsertImage: (wikitext: string) => void;

  onInsertInfobox: (wikitext: string) => void;

  onInsertCountryStats: (wikitext: string) => void;

  onInsertBusinessStats: (wikitext: string) => void;

  onInsertMapCoords: (wikitext: string) => void;

  editingTemplate?: {
    id: string;
    name: string;
    params: Record<string, string>;
  } | null;
  setEditingTemplate?: (val: null) => void;
  onUpdateTemplate?: (params: Record<string, string>) => void;
  onUpdateTemplateRaw?: (wikitext: string) => void;
  onRemoveTemplate?: () => void;
}

export function WikiEditorModalHost({
  onInsertImage,
  onInsertInfobox,
  onInsertCountryStats,
  onInsertBusinessStats,
  onInsertMapCoords,
  editingTemplate,
  setEditingTemplate,
  onUpdateTemplate,
  onUpdateTemplateRaw,
  onRemoveTemplate,
}: WikiEditorModalHostProps) {
  const modal = useEditorModalContext();
  return (
    <>
      <ImageSearchModal
        isOpen={modal.showImageSearch}
        onClose={() => modal.setShowImageSearch(false)}
        onInsert={onInsertImage}
      />

      <InfoboxCountryModal
        isOpen={modal.showInfoboxModal}
        onClose={() => modal.setShowInfoboxModal(false)}
        onInsert={onInsertInfobox}
      />

      <CountryStatsModal
        isOpen={modal.showCountryStatsModal}
        onClose={() => modal.setShowCountryStatsModal(false)}
        onInsert={onInsertCountryStats}
      />

      <BusinessStatsModal
        isOpen={modal.showBusinessStatsModal}
        onClose={() => modal.setShowBusinessStatsModal(false)}
        onInsert={onInsertBusinessStats}
      />

      <MapCoordsModal
        isOpen={modal.showMapCoordsModal}
        onClose={() => modal.setShowMapCoordsModal(false)}
        onInsert={onInsertMapCoords}
      />

      {editingTemplate &&
        setEditingTemplate &&
        (onUpdateTemplate || onUpdateTemplateRaw) &&
        onRemoveTemplate && (
          <TemplateEditorDialog
            templateName={editingTemplate.name}
            params={editingTemplate.params}
            onSave={(p) => onUpdateTemplate?.(p)}
            onSaveRaw={onUpdateTemplateRaw}
            onClose={() => setEditingTemplate(null)}
            onRemove={onRemoveTemplate}
          />
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Template Editor Dialog (For editing an active template on click in Visual mode)
// ---------------------------------------------------------------------------
function TemplateEditorDialog({
  templateName,
  params,
  onSave,
  onSaveRaw,
  onClose,
  onRemove,
}: {
  templateName: string;
  params: Record<string, string>;
  onSave: (p: Record<string, string>) => void;
  /** Raw wikitext save for templates without a TemplateData schema. */
  onSaveRaw?: (wikitext: string) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({ ...params });
  const [showPreview, setShowPreview] = useState(false);
  const { paramList, hasSchema, loading } = useTemplateSchema(templateName);
  const [rawWikitext, setRawWikitext] = useState(
    () =>
      `{{${templateName}${Object.entries(params)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `|${k}=${v}`)
        .join("")}}}`
  );

  const previewQuery = api.wikios.getTemplatePreview.useQuery(
    { template: templateName, params: values },
    { enabled: showPreview, staleTime: 0 }
  );

  const schemaKeySet = React.useMemo(() => new Set(paramList.map((p) => p.key)), [paramList]);
  const extraKeys = React.useMemo(
    () => Object.keys(params).filter((k) => !schemaKeySet.has(k)),
    [params, schemaKeySet]
  );

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div
        className="wikios-quick-modal wikios-ve-template-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <Puzzle className="h-4 w-4" />
            <span>Edit: {templateName}</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="wikios-quick-modal-body">
          {loading && (
            <div className="text-muted-foreground py-4 text-center text-xs">
              Loading template schema...
            </div>
          )}

          {!loading && !hasSchema && (
            <div className="wikios-ve-template-field">
              <label className="wikios-ve-template-field-label">
                Wikitext{" "}
                <span className="text-muted-foreground">
                  (no TemplateData schema — edit source directly)
                </span>
              </label>
              <textarea
                value={rawWikitext}
                onChange={(e) => setRawWikitext(e.target.value)}
                rows={5}
                className="border-border/40 bg-background text-foreground focus:border-wiki/60 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
              />
            </div>
          )}

          {!loading && hasSchema && (
            <>
              {paramList.map(({ key, meta }) => (
                <div key={key} className="wikios-ve-template-field">
                  <label className="wikios-ve-template-field-label">
                    {meta.label ?? key}
                    {meta.required && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                  {meta.description && (
                    <div className="wikios-ti-param-desc">{meta.description}</div>
                  )}
                  <input
                    type="text"
                    value={values[key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="wikios-ti-param-input"
                    placeholder={meta.example ?? `Enter ${meta.label ?? key}...`}
                  />
                </div>
              ))}

              {extraKeys.map((key) => (
                <div key={key} className="wikios-ve-template-field">
                  <label className="wikios-ve-template-field-label">{key}</label>
                  <input
                    type="text"
                    value={values[key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="wikios-ti-param-input"
                    placeholder={`Enter ${key}...`}
                  />
                </div>
              ))}
            </>
          )}

          {showPreview && previewQuery.data && (
            <div
              className="wikios-ti-preview"
              dangerouslySetInnerHTML={{ __html: previewQuery.data }}
            />
          )}
        </div>
        <div className="wikios-ve-template-dialog-footer">
          <button onClick={onRemove} className="wikios-ve-template-remove">
            Remove template
          </button>
          <div className="wikios-ve-template-dialog-actions">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="wikios-ve-btn wikios-ve-btn-ghost"
              type="button"
            >
              {showPreview ? "Hide Preview" : "Preview"}
            </button>
            <button
              onClick={() => {
                if (hasSchema || !onSaveRaw) {
                  onSave(values);
                } else {
                  onSaveRaw(rawWikitext.trim());
                }
              }}
              className="wikios-ve-btn wikios-ve-btn-primary"
              type="button"
            >
              Update Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
