// src/components/wiki-os/editor/TemplateInserter.tsx
// Searchable template picker with parameter form for the WikiOS editor.
// Fetches TemplateData from the registry and renders dynamic input forms.

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, ChevronDown, ChevronRight, Eye, Plus } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface TemplateParam {
  label?: string;
  description?: string;
  type?: string;
  default?: string;
  required?: boolean;
  suggested?: boolean;
  example?: string;
  aliases?: string[];
}

interface TemplateInserterProps {
  onInsert: (templateName: string, params: Record<string, string>) => void;
  onClose: () => void;
}

export function TemplateInserter({ onInsert, onClose }: TemplateInserterProps) {
  const [query, setQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search templates
  const searchQuery = api.wikios.searchTemplates.useQuery(
    { query, limit: 20 },
    { enabled: query.length >= 2 }
  );

  // Get template data when one is selected
  const templateData = api.wikios.getTemplateData.useQuery(
    { name: selectedTemplate! },
    { enabled: !!selectedTemplate }
  );

  // Preview
  const previewQuery = api.wikios.getTemplatePreview.useQuery(
    { name: selectedTemplate!, params: paramValues },
    { enabled: !!selectedTemplate && showPreview }
  );

  const handleSelect = useCallback((name: string) => {
    setSelectedTemplate(name);
    setParamValues({});
    setShowPreview(false);
  }, []);

  const handleParamChange = useCallback((key: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleInsert = useCallback(() => {
    if (!selectedTemplate) return;
    onInsert(selectedTemplate, paramValues);
    onClose();
  }, [selectedTemplate, paramValues, onInsert, onClose]);

  // Parse TemplateData params
  const tdParams: Record<string, TemplateParam> =
    (templateData.data?.templateData as { params?: Record<string, TemplateParam> })?.params ?? {};
  const paramOrder: string[] =
    (templateData.data?.templateData as { paramOrder?: string[] })?.paramOrder ??
    Object.keys(tdParams);

  return (
    <div className="wikios-template-inserter">
      {/* Header */}
      <div className="wikios-ti-header">
        <h3 className="wikios-ti-title">Insert Template</h3>
        <button onClick={onClose} className="wikios-ti-close" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      {!selectedTemplate && (
        <div className="wikios-ti-search">
          <Search size={14} className="wikios-ti-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates..."
            className="wikios-ti-search-input"
          />
        </div>
      )}

      {/* Results */}
      {!selectedTemplate && query.length >= 2 && (
        <div className="wikios-ti-results">
          {searchQuery.isLoading && <div className="wikios-ti-loading">Searching...</div>}
          {searchQuery.data?.templates.map((t) => (
            <button key={t.name} onClick={() => handleSelect(t.name)} className="wikios-ti-result">
              <div className="wikios-ti-result-name">{t.name}</div>
              {t.description && <div className="wikios-ti-result-desc">{t.description}</div>}
              {t.category && (
                <span className={cn("wikios-ti-badge", `wikios-ti-badge-${t.category}`)}>
                  {t.category}
                </span>
              )}
            </button>
          ))}
          {searchQuery.data?.templates.length === 0 && !searchQuery.isLoading && (
            <div className="wikios-ti-empty">No templates found</div>
          )}
        </div>
      )}

      {/* Parameter Form */}
      {selectedTemplate && (
        <div className="wikios-ti-form">
          <button onClick={() => setSelectedTemplate(null)} className="wikios-ti-back">
            <ChevronRight size={14} className="rotate-180" />
            <span>Back to search</span>
          </button>

          <div className="wikios-ti-form-header">
            <h4 className="wikios-ti-template-name">{selectedTemplate}</h4>
            {templateData.data?.description && (
              <p className="wikios-ti-template-desc">{templateData.data.description}</p>
            )}
          </div>

          {templateData.isLoading && <div className="wikios-ti-loading">Loading parameters...</div>}

          {paramOrder.length > 0 && (
            <div className="wikios-ti-params">
              {paramOrder.map((key) => {
                const param = tdParams[key];
                if (!param) return null;
                return (
                  <div key={key} className="wikios-ti-param">
                    <label className="wikios-ti-param-label">
                      {param.label ?? key}
                      {param.required && <span className="wikios-ti-required">*</span>}
                    </label>
                    {param.description && (
                      <div className="wikios-ti-param-desc">{param.description}</div>
                    )}
                    <input
                      type="text"
                      value={paramValues[key] ?? param.default ?? ""}
                      onChange={(e) => handleParamChange(key, e.target.value)}
                      placeholder={param.example ?? `Enter ${param.label ?? key}...`}
                      className="wikios-ti-param-input"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {paramOrder.length === 0 && !templateData.isLoading && (
            <div className="wikios-ti-no-params">
              No parameter schema available. Template will be inserted with empty parameters.
            </div>
          )}

          {/* Preview toggle */}
          <button onClick={() => setShowPreview(!showPreview)} className="wikios-ti-preview-toggle">
            <Eye size={14} />
            <span>{showPreview ? "Hide Preview" : "Show Preview"}</span>
            {showPreview ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {showPreview && previewQuery.data && (
            <div
              className="wikios-ti-preview"
              dangerouslySetInnerHTML={{ __html: previewQuery.data.html }}
            />
          )}

          {/* Insert button */}
          <div className="wikios-ti-actions">
            <button onClick={onClose} className="wikios-ti-cancel">
              Cancel
            </button>
            <button onClick={handleInsert} className="wikios-ti-insert">
              <Plus size={14} />
              Insert Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
