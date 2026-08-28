"use client";
// src/app/admin/countries/CountriesAdminPanel.tsx
// Dedicated Country Administration Suite with live editing, formula inspector, and roster import

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
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
      <AdminHeader
        icon={Globe}
        title="Country Administration & God-Mode"
        description="Edit live nation attributes, inspect formula simulation states, and import roster updates."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="grid"
            className="flex items-center gap-2 rounded-lg text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Globe className="h-4 w-4" />
            Live Country Grid
          </TabsTrigger>
          <TabsTrigger
            value="inspector"
            className="flex items-center gap-2 rounded-lg text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Search className="h-4 w-4" />
            Country Inspector & Formulas
          </TabsTrigger>
          <TabsTrigger
            value="import"
            className="flex items-center gap-2 rounded-lg text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <FileText className="h-4 w-4" />
            Roster Import & Sync
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

export default CountriesAdminPanel;
