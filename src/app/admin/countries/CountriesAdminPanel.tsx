"use client";
// src/app/admin/countries/CountriesAdminPanel.tsx
// Dedicated Country Administration Suite with live editing, formula inspector, and roster import

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Globe, Search, Page as FileText } from "iconoir-react";
import { CountryAdminPanel } from "../_components/CountryAdminPanel";
import { CountryInspector } from "../_components/CountryInspector";
import { DataImportCard } from "../_components/platform/DataImportCard";
import { ImportPreviewDialog } from "../_components/ImportPreviewDialog";
import { useAdminState } from "../_hooks/useAdminState";
import { useAdminHandlers } from "../_hooks/useAdminHandlers";

export function CountriesAdminPanel() {
  usePageTitle({ title: "Admin - Countries" });
  const [activeTab, setActiveTab] = useState("grid");

  const { importState, setImportState } = useAdminState();

  const { handleFileSelect, handleImportConfirm, handleImportClose } = useAdminHandlers({
    importState,
    setImportState,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Country administration"
        subtitle="Edit live nation attributes, inspect formula states and import roster updates."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-fill-3 rounded-row mb-4 flex w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger
            value="grid"
            className="rounded-control text-caption flex items-center gap-2"
          >
            <Globe className="h-4 w-4" />
            Live country grid
          </TabsTrigger>
          <TabsTrigger
            value="inspector"
            className="rounded-control text-caption flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Country inspector & formulas
          </TabsTrigger>
          <TabsTrigger
            value="import"
            className="rounded-control text-caption flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Roster import & sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-4 focus-visible:outline-none">
          <CountryAdminPanel />
        </TabsContent>

        <TabsContent value="inspector" className="mt-4 focus-visible:outline-none">
          <CountryInspector />
        </TabsContent>

        <TabsContent value="import" className="mt-4 space-y-6 focus-visible:outline-none">
          <DataImportCard
            onFileSelect={handleFileSelect}
            isUploading={importState.isUploading}
            isAnalyzing={importState.isAnalyzing}
            analyzeError={importState.analyzeError}
            importError={importState.importError}
          />
          {importState.showPreview && importState.previewData && (
            <ImportPreviewDialog
              isOpen={importState.showPreview}
              onClose={handleImportClose}
              onConfirm={handleImportConfirm}
              changes={importState.previewData.changes}
              isLoading={importState.isUploading}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
