"use client";

import React from 'react';
import { DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Building2, X, Save } from 'lucide-react';

interface ModalHeaderProps {
  overallEffectiveness: number;
  isValid: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ModalHeader({
  overallEffectiveness,
  isValid,
  isSaving,
  onClose,
  onSave
}: ModalHeaderProps) {
  return (
    <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <DialogTitle className="text-xl font-semibold">Economy Builder</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Configure your economic system with atomic components
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Effectiveness Display */}
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {overallEffectiveness.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Effectiveness</div>
            </div>
            <div className="w-12 h-12 relative">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${overallEffectiveness * 2.51} 251`}
                  className="text-green-600 dark:text-green-400 transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={!isValid || isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Economy
            </Button>
          </div>
        </div>
      </div>
    </DialogHeader>
  );
}
