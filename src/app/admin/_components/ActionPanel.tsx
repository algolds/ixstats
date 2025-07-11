// src/app/admin/_components/ActionPanel.tsx
"use client";

import { Save } from "lucide-react";

interface ActionPanelProps {
  lastUpdate: Date | null;
  onSaveConfig: () => void;
  savePending: boolean;
}

export function ActionPanel({ lastUpdate, onSaveConfig, savePending }: ActionPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Save Configuration</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Apply your changes to the system.
            {lastUpdate && (
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                (Last saved: {lastUpdate.toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onSaveConfig}
          disabled={savePending}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-md font-medium flex items-center"
        >
          <Save className="h-4 w-4 mr-2" />
          {savePending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}