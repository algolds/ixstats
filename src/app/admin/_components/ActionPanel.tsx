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
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Save Configuration
          </h2>
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
          className="flex items-center rounded-md bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <Save className="mr-2 h-4 w-4" />
          {savePending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
