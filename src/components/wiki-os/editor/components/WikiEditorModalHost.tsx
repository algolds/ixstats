// src/components/wiki-os/editor/components/WikiEditorModalHost.tsx
// Centralized modal host for WikiOS Visual and Source editors.

"use client";

import React, { useState } from "react";
import { Puzzle, Xmark as X } from "iconoir-react";
import { api } from "~/trpc/react";
import { ImageSearchModal } from "~/components/wiki-os/editor/ImageSearchModal";
import { TemplateInserter } from "~/components/wiki-os/editor/TemplateInserter";
import {
  InfoboxCountryModal,
  CountryStatsModal,
  BusinessStatsModal,
  MapCoordsModal,
} from "~/components/wiki-os/editor/WikiTemplateModals";

export interface WikiEditorModalHostProps {
  showImageSearch: boolean;
  setShowImageSearch: (open: boolean) => void;
  onInsertImage: (wikitext: string) => void;

  showTemplateInserter?: boolean;
  setShowTemplateInserter?: (open: boolean) => void;
  onInsertTemplate?: (name: string, params: Record<string, string>) => void;

  showInfoboxModal: boolean;
  setShowInfoboxModal: (open: boolean) => void;
  onInsertInfobox: (wikitext: string) => void;

  showCountryStatsModal: boolean;
  setShowCountryStatsModal: (open: boolean) => void;
  onInsertCountryStats: (wikitext: string) => void;

  showBusinessStatsModal: boolean;
  setShowBusinessStatsModal: (open: boolean) => void;
  onInsertBusinessStats: (wikitext: string) => void;

  showMapCoordsModal: boolean;
  setShowMapCoordsModal: (open: boolean) => void;
  onInsertMapCoords: (wikitext: string) => void;

  editingTemplate?: {
    element: HTMLElement;
    name: string;
    params: Record<string, string>;
  } | null;
  setEditingTemplate?: (val: null) => void;
  onUpdateTemplate?: (params: Record<string, string>) => void;
  onRemoveTemplate?: () => void;
}

export function WikiEditorModalHost({
  showImageSearch,
  setShowImageSearch,
  onInsertImage,
  showTemplateInserter,
  setShowTemplateInserter,
  onInsertTemplate,
  showInfoboxModal,
  setShowInfoboxModal,
  onInsertInfobox,
  showCountryStatsModal,
  setShowCountryStatsModal,
  onInsertCountryStats,
  showBusinessStatsModal,
  setShowBusinessStatsModal,
  onInsertBusinessStats,
  showMapCoordsModal,
  setShowMapCoordsModal,
  onInsertMapCoords,
  editingTemplate,
  setEditingTemplate,
  onUpdateTemplate,
  onRemoveTemplate,
}: WikiEditorModalHostProps) {
  return (
    <>
      <ImageSearchModal
        isOpen={showImageSearch}
        onClose={() => setShowImageSearch(false)}
        onInsert={onInsertImage}
      />

      {showTemplateInserter && onInsertTemplate && setShowTemplateInserter && (
        <TemplateInserter
          onInsert={onInsertTemplate}
          onClose={() => setShowTemplateInserter(false)}
        />
      )}

      <InfoboxCountryModal
        isOpen={showInfoboxModal}
        onClose={() => setShowInfoboxModal(false)}
        onInsert={onInsertInfobox}
      />

      <CountryStatsModal
        isOpen={showCountryStatsModal}
        onClose={() => setShowCountryStatsModal(false)}
        onInsert={onInsertCountryStats}
      />

      <BusinessStatsModal
        isOpen={showBusinessStatsModal}
        onClose={() => setShowBusinessStatsModal(false)}
        onInsert={onInsertBusinessStats}
      />

      <MapCoordsModal
        isOpen={showMapCoordsModal}
        onClose={() => setShowMapCoordsModal(false)}
        onInsert={onInsertMapCoords}
      />

      {editingTemplate && setEditingTemplate && onUpdateTemplate && onRemoveTemplate && (
        <TemplateEditorDialog
          templateName={editingTemplate.name}
          params={editingTemplate.params}
          onSave={onUpdateTemplate}
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
  onClose,
  onRemove,
}: {
  templateName: string;
  params: Record<string, string>;
  onSave: (p: Record<string, string>) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({ ...params });
  const [showPreview, setShowPreview] = useState(false);

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
  const allKeys = [...new Set([...Object.keys(params), ...Object.keys(tdParams)])];

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
          {allKeys.map((key) => {
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
                  placeholder={`Enter ${schema?.label ?? key}...`}
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
              onClick={() => onSave(values)}
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
