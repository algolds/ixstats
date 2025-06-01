// src/app/admin/_components/ImportPreviewDialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { ScrollArea } from "~/components/ui/scroll-area"; // Assuming you might need ScrollArea for many changes
import { Alert, AlertDescription } from "~/components/ui/alert";
import { ImportChange } from "~/types/ixstats"; // Assuming this type definition
import { useState } from "react";
import { Loader2, AlertTriangle, Info } from "lucide-react";

interface ImportPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (replaceExisting: boolean) => void;
  changes: ImportChange[]; // Assuming this is the structure for changes
  isLoading: boolean;
}

export function ImportPreviewDialog({
  isOpen,
  onClose,
  onConfirm,
  changes,
  isLoading,
}: ImportPreviewDialogProps) {
  const [replaceExisting, setReplaceExisting] = useState(false);

  if (!isOpen) {
    return null;
  }

  const newCountries = changes.filter(c => c.type === 'new');
  const updatedCountries = changes.filter(c => c.type === 'update');
  const skippedCountries = changes.filter(c => c.type === 'skip' || c.type === 'no-change');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
            Import Preview
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Review the changes before importing the data.
            {changes.length === 0 && " No changes detected in the uploaded file."}
          </DialogDescription>
        </DialogHeader>

        {changes.length > 0 && (
           <div className="my-4 space-y-3">
            <Alert variant="default" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
              <Info className="h-5 w-5 text-blue-500" />
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Found {newCountries.length} new countries to add and {updatedCountries.length} countries to update. {skippedCountries.length} countries will be skipped or have no changes.
              </AlertDescription>
            </Alert>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="replaceExisting"
                checked={replaceExisting}
                onCheckedChange={(checked) => setReplaceExisting(Boolean(checked))}
                disabled={isLoading}
              />
              <Label htmlFor="replaceExisting" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Replace data for existing countries
              </Label>
            </div>
             <p className="text-xs text-gray-500 dark:text-gray-400">
                If unchecked, existing countries will be skipped. New countries will always be added. Historical data and DM inputs are preserved.
             </p>
          </div>
        )}

        {changes.length > 0 && (
            <ScrollArea className="h-[200px] w-full rounded-md border dark:border-gray-700 p-4 my-4">
            <div className="space-y-2">
              {newCountries.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-green-600 dark:text-green-400">New Countries ({newCountries.length}):</h4>
                  <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-300">
                    {newCountries.slice(0, 10).map(change => <li key={change.countryName}>{change.countryName}</li>)}
                    {newCountries.length > 10 && <li>...and {newCountries.length - 10} more.</li>}
                  </ul>
                </div>
              )}
              {updatedCountries.length > 0 && (
                <div className="mt-2">
                  <h4 className="font-semibold text-sm text-yellow-600 dark:text-yellow-400">Updated Countries ({updatedCountries.length}):</h4>
                  <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-300">
                    {updatedCountries.slice(0,10).map(change => <li key={change.countryName}>{change.countryName} (Fields: {change.changedFields?.join(', ') ?? 'N/A'})</li>)}
                    {updatedCountries.length > 10 && <li>...and {updatedCountries.length - 10} more.</li>}
                  </ul>
                </div>
              )}
               {skippedCountries.length > 0 && (
                <div className="mt-2">
                  <h4 className="font-semibold text-sm text-gray-500 dark:text-gray-400">Skipped/No Change ({skippedCountries.length}):</h4>
                   <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-300">
                    {skippedCountries.slice(0,5).map(change => <li key={change.countryName}>{change.countryName}</li>)}
                    {skippedCountries.length > 5 && <li>...and {skippedCountries.length - 5} more.</li>}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        )}


        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
            Cancel
          </Button>
          <Button 
            onClick={() => onConfirm(replaceExisting)} 
            disabled={isLoading || changes.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              "Confirm Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
