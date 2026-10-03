"use client";

import React, { useState } from "react";
import {
  OpenBook as BookOpen,
  Plus,
  Upload,
  Trash as Trash2,
  EditPencil as Edit3,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { FileImportDropzone, type ParsedLoreSection } from "./dossier/FileImportDropzone";
import type { LoreDoc } from "./useNativeLore";

/** The "Native Lore" side of the dossier: custom documents, file import and the empty state. */
export function NativeLoreView({
  docs,
  onNew,
  onEdit,
  onDelete,
  onImport,
}: {
  docs: LoreDoc[];
  onNew: () => void;
  onEdit: (doc: LoreDoc) => void;
  onDelete: (id: string) => void;
  onImport: (sections: ParsedLoreSection[]) => void;
}) {
  const [showFileImport, setShowFileImport] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-label text-headline">Native lore documents</h3>
          <p className="text-label-secondary text-footnote">
            Custom dossier documents created via the WikiOS Canvas Editor or file import.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFileImport(!showFileImport)}
            className="text-caption gap-2 font-semibold"
          >
            <Upload className="h-3.5 w-3.5" />
            {showFileImport ? "Hide Import" : "Import Files"}
          </Button>
          <Button size="sm" onClick={onNew} className="text-footnote gap-2">
            <Plus className="h-3.5 w-3.5" />
            New document
          </Button>
        </div>
      </div>

      {showFileImport && (
        <FileImportDropzone
          onImportSections={(sections) => {
            onImport(sections);
            setShowFileImport(false);
          }}
          onCancel={() => setShowFileImport(false)}
        />
      )}

      {docs.length === 0 ? (
        <Card className="rounded-card">
          <CardContent className="p-8 text-center">
            <BookOpen className="text-label-secondary mx-auto mb-3 h-6 w-6" />
            <h3 className="text-label text-title-3 mb-2">No native lore documents</h3>
            <p className="text-label-secondary text-body mx-auto mb-6 max-w-md">
              Create custom dossier documents directly using the WikiOS Canvas Editor or import
              existing markdown/text files.
            </p>
            <Button onClick={onNew}>Create first document</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {docs.map((doc) => (
            <Card key={doc.id} className="rounded-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-label text-headline truncate">{doc.title}</h4>
                    <Badge variant="outline" className="capitalize">
                      {doc.clearance.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-label-secondary text-footnote mt-1 line-clamp-3">
                    {doc.content.replace(/<[^>]*>/g, "").slice(0, 150)}...
                  </p>
                </div>
              </div>

              <div className="border-separator mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-label-secondary text-footnote">
                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(doc)}
                    title="Edit document"
                    aria-label={`Edit ${doc.title}`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-destructive h-8 w-8"
                    onClick={() => onDelete(doc.id)}
                    title="Delete document"
                    aria-label={`Delete ${doc.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
