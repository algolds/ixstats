/**
 * Map page header component - Google Maps style
 * Clean, minimal header with search-like appearance
 */

"use client";

import React from "react";
import { RiMapPinLine, RiRefreshLine } from "react-icons/ri";

interface PageHeaderProps {
  territoryCount?: number;
  onRefresh: () => void;
  isLoading: boolean;
  tilesLoaded: boolean;
}

export function PageHeader({ territoryCount, onRefresh, isLoading }: PageHeaderProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <RiMapPinLine className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">IxStats Map Editor</h1>
            <p className="text-sm text-gray-500">
              {isLoading ? (
                "Loading map data..."
              ) : territoryCount ? (
                `${territoryCount} territories • Interactive boundary editor`
              ) : (
                "Interactive boundary editor"
              )}
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RiRefreshLine className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
    </div>
  );
}
