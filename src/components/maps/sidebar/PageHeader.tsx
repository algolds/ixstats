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
    <div className="rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
            <RiMapPinLine className="text-xl text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">IxStats Map Editor</h1>
            <p className="text-sm text-gray-500">
              {isLoading
                ? "Loading map data..."
                : territoryCount
                  ? `${territoryCount} territories • Interactive boundary editor`
                  : "Interactive boundary editor"}
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RiRefreshLine className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
    </div>
  );
}
