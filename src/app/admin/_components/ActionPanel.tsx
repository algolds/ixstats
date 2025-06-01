// src/app/admin/_components/ActionPanel.tsx
"use client";

import { Save } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

interface ActionPanelProps {
  lastUpdate: Date | null;
  onSaveConfig: () => void;
  savePending: boolean;
}

export function ActionPanel({ lastUpdate, onSaveConfig, savePending }: ActionPanelProps) {
  return (
    <Card className="mb-8 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg text-gray-900 dark:text-white">Save Configuration</CardTitle>
            <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
              Apply your changes to the system.
              {lastUpdate && (
                <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                  (Last saved: {lastUpdate.toLocaleTimeString()})
                </span>
              )}
            </CardDescription>
          </div>
          <Button
            onClick={onSaveConfig}
            disabled={savePending}
            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <Save className="h-4 w-4 mr-2" />
            {savePending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardHeader>
      {/* CardContent or CardFooter can be used if there's more to display */}
    </Card>
  );
}
