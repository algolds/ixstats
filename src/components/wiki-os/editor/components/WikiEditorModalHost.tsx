"use client";
// src/components/wiki-os/editor/components/WikiEditorModalHost.tsx
// Centralized modal host for WikiOS Visual and Source editors.

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Puzzle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useEditorModalContext } from "../context/EditorModalContext";
import { useTemplateSchema } from "../hooks/useTemplateSchema";

const ImageSearchModal = dynamic(
  () => import("~/components/wiki-os/editor/ImageSearchModal").then((m) => m.ImageSearchModal),
  { ssr: false }
);
const InfoboxCountryModal = dynamic(
  () =>
    import("~/components/wiki-os/editor/template-modals/InfoboxCountryModal").then(
      (m) => m.InfoboxCountryModal
    ),
  { ssr: false }
);
const CountryStatsModal = dynamic(
  () =>
    import("~/components/wiki-os/editor/template-modals/CountryStatsModal").then(
      (m) => m.CountryStatsModal
    ),
  { ssr: false }
);
const BusinessStatsModal = dynamic(
  () =>
    import("~/components/wiki-os/editor/template-modals/BusinessStatsModal").then(
      (m) => m.BusinessStatsModal
    ),
  { ssr: false }
);
const MapCoordsModal = dynamic(
  () =>
    import("~/components/wiki-os/editor/template-modals/MapCoordsModal").then(
      (m) => m.MapCoordsModal
    ),
  { ssr: false }
);

interface WikiEditorModalHostProps {
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
      {modal.showImageSearch && (
        <ImageSearchModal
          isOpen={modal.showImageSearch}
          onClose={() => modal.setShowImageSearch(false)}
          onInsert={onInsertImage}
        />
      )}

      {modal.showInfoboxModal && (
        <InfoboxCountryModal
          isOpen={modal.showInfoboxModal}
          onClose={() => modal.setShowInfoboxModal(false)}
          onInsert={onInsertInfobox}
        />
      )}

      {modal.showCountryStatsModal && (
        <CountryStatsModal
          isOpen={modal.showCountryStatsModal}
          onClose={() => modal.setShowCountryStatsModal(false)}
          onInsert={onInsertCountryStats}
        />
      )}

      {modal.showBusinessStatsModal && (
        <BusinessStatsModal
          isOpen={modal.showBusinessStatsModal}
          onClose={() => modal.setShowBusinessStatsModal(false)}
          onInsert={onInsertBusinessStats}
        />
      )}

      {modal.showMapCoordsModal && (
        <MapCoordsModal
          isOpen={modal.showMapCoordsModal}
          onClose={() => modal.setShowMapCoordsModal(false)}
          onInsert={onInsertMapCoords}
        />
      )}

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[80vh] max-w-lg flex-col gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="border-separator text-headline flex items-center gap-2 border-b px-5 py-4 pr-14">
          <Puzzle className="text-tint size-4" aria-hidden="true" />
          Edit: {templateName}
        </DialogTitle>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="text-label-secondary text-footnote py-4 text-center">
              Loading template schema...
            </div>
          )}

          {!loading && !hasSchema && (
            <div className="wikios-ve-template-field">
              <label className="wikios-ve-template-field-label">
                Wikitext{" "}
                <span className="text-label-secondary">
                  (no TemplateData schema; edit the source directly)
                </span>
              </label>
              <Textarea
                value={rawWikitext}
                onChange={(e) => setRawWikitext(e.target.value)}
                rows={5}
                className="text-footnote font-mono"
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
                  <Input
                    type="text"
                    value={values[key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    placeholder={meta.example ?? `Enter ${meta.label ?? key}...`}
                  />
                </div>
              ))}

              {extraKeys.map((key) => (
                <div key={key} className="wikios-ve-template-field">
                  <label className="wikios-ve-template-field-label">{key}</label>
                  <Input
                    type="text"
                    value={values[key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
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
        <div className="border-separator flex items-center justify-between gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-red">
            Remove template
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? "Hide Preview" : "Preview"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (hasSchema || !onSaveRaw) {
                  onSave(values);
                } else {
                  onSaveRaw(rawWikitext.trim());
                }
              }}
            >
              Update template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
