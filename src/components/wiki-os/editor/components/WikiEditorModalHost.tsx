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

      {editingTemplate && setEditingTemplate && (onUpdateTemplate || onUpdateTemplateRaw) && onRemoveTemplate && (
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
  const { paramList, hasSchema } = useTemplateSchema(templateName);
  const [rawWikitext, setRawWikitext] = useState(() =>
    `{{${templateName}${Object.entries(params).filter(([, v]) => v.trim()).map(([k, v]) => `|${k}=${v}`).join("")}}}`
  );

  const tdQuery = api.wikios.getTemplateData.useQuery(
    { title: templateName },
    { staleTime: 300000 }
  );
  const previewQuery = api.wikios.getTemplatePreview.useQuery(
    { template: templateName, params: values },
    { enabled: showPreview, staleTime: 0 }
  );

  const tdParams =
    (
      tdQuery.data?.templateData as {
        params?: Record<string, { label?: string; description?: string; required?: boolean }>;
      }
    )?.params ?? {};
  const allKeys = hasSchema
    ? [
        ...paramList.filter((p) => p.meta.required).map((p) => p.key),
        ...paramList.filter((p) => !p.meta.required).map((p) => p.key),
        ...Object.keys(params).filter((k) => !paramList.some((p) => p.key === k)),
      ]
    : [...new Set([...Object.keys(params), ...Object.keys(tdParams)])];

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
          {!hasSchema && (
            <div className="wikios-ve-template-field">
              <label className="wikios-ve-template-field-label">
                Wikitext <span className="text-muted-foreground">(no TemplateData schema — edit source directly)</span>
              </label>
              <textarea
                value={rawWikitext}
                onChange={(e) => setRawWikitext(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-border/40 bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-wiki/60"
              />
            </div>
          )}
          {hasSchema && allKeys.map((key) => {
            const schema = tdParams[key];
            return (
              <div key={key} className="wikios-ve-template-field">
                <label className="wikios-ve-template-field-label">
                  {schema?.label ?? key}
                  {schema?.required && <span className="text-destructive ml-0.5">*</span>}
                </label>
                {schema?.description && (
                  <div className="wikios-ti-param-desc">{schema.description}</div>
                )}
                <input
                  type="text"
                  value={values[key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  className="wikios-ti-param-input"
                  placeholder={(schema as { example?: string })?.example ?? `Enter ${schema?.label ?? key}...`}
                />
              </div>
            );
          })}
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
                } else if (rawWikitext.trim() && rawWikitext !== rawWikitext.trim()) {
                  onSaveRaw(rawWikitext.trim());
                } else {
                  onSaveRaw(rawWikitext);
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
