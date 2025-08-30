import React from 'react';
import { SearchView } from './SearchView';
import { NotificationsView } from './NotificationsView';
import { SettingsView } from './SettingsView';
import type { ViewMode } from './types';

interface ExpandedViewProps {
  mode: ViewMode;
  onClose: () => void;
}

export function ExpandedView({ mode, onClose }: ExpandedViewProps) {
  // Don't render if mode is compact or cycling
  if (mode === 'compact' || mode === 'cycling') {
    return null;
  }

  return (
    <div className="hidden lg:block absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-[10002]">
      <div 
        className="command-palette-dropdown border-border dark:border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[500px] max-w-[800px] relative"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        {/* Refraction border effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-white/20 to-transparent" />
        </div>
        
        <div className="relative z-10">
          {mode === 'search' && <SearchView 
            searchQuery=""
            searchFilter="all"
            debouncedSearchQuery=""
            searchResults={[]}
            closeDropdown={onClose}
          />}
          {mode === 'notifications' && <NotificationsView onClose={onClose} />}
          {mode === 'settings' && <SettingsView onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
