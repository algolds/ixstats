'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import {
  Menu,
  X,
  Layers,
  Ruler,
  Settings,
  Eye,
  Download,
  Share2,
  Code,
  Keyboard,
  HelpCircle,
  Info,
  AlertCircle,
  FileJson,
  MapPin,
} from 'lucide-react';
import type { ProjectionType } from '~/types/maps';

interface GoogleHamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;

  // Layer controls
  layers: {
    boundaries: boolean;
    subdivisions: boolean;
    cities: boolean;
    pois: boolean;
  };
  onLayerToggle: (layer: string, visible: boolean) => void;

  // Measurement tools
  measurementMode: 'distance' | 'area' | null;
  onMeasurementModeChange: (mode: 'distance' | 'area' | null) => void;
  showScale: boolean;
  onShowScaleChange: (show: boolean) => void;

  // Map settings
  mapType: 'map' | 'climate' | 'terrain';
  onMapTypeChange: (type: 'map' | 'climate' | 'terrain') => void;
  projection: ProjectionType;
  onProjectionChange: (type: ProjectionType) => void;

  // View options
  showLabels: boolean;
  onShowLabelsChange: (show: boolean) => void;
  showBorders: boolean;
  onShowBordersChange: (show: boolean) => void;
}

const SETTINGS_KEY = 'ixstats-map-settings';

function GoogleHamburgerMenu({
  isOpen,
  onClose,
  layers,
  onLayerToggle,
  measurementMode,
  onMeasurementModeChange,
  showScale,
  onShowScaleChange,
  mapType,
  onMapTypeChange,
  projection,
  onProjectionChange,
  showLabels,
  onShowLabelsChange,
  showBorders,
  onShowBordersChange,
}: GoogleHamburgerMenuProps) {
  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Save settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          layers,
          showScale,
          showLabels,
          showBorders,
          mapType,
          projection,
          measurementMode,
        })
      );
    }
  }, [layers, showScale, showLabels, showBorders, mapType, projection, measurementMode]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className="fixed top-0 left-0 h-full w-80 bg-white/95 backdrop-blur-xl border-r border-gray-200 shadow-2xl z-50 overflow-y-auto transform transition-transform duration-300 ease-out"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Menu className="h-5 w-5 text-gray-700" />
            <h2 className="text-base font-semibold text-gray-900">Map Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="pb-6">
          {/* 1. Map Layers Section */}
          <MenuSection icon={Layers} title="Map Layers">
            <Toggle
              label="Political Boundaries"
              checked={layers.boundaries}
              onChange={(checked) => onLayerToggle('boundaries', checked)}
            />
            <Toggle
              label="Subdivisions"
              checked={layers.subdivisions}
              onChange={(checked) => onLayerToggle('subdivisions', checked)}
            />
            <Toggle
              label="Cities & Towns"
              checked={layers.cities}
              onChange={(checked) => onLayerToggle('cities', checked)}
            />
            <Toggle
              label="Points of Interest"
              checked={layers.pois}
              onChange={(checked) => onLayerToggle('pois', checked)}
            />
            <TextButton onClick={() => alert('Advanced layer settings coming soon')}>
              Advanced Layer Settings →
            </TextButton>
          </MenuSection>

          {/* 2. Measurement Tools Section */}
          <MenuSection icon={Ruler} title="Measurement Tools">
            <RadioGroup
              value={measurementMode}
              onChange={(value) => onMeasurementModeChange(value as 'distance' | 'area' | null)}
              options={[
                { value: 'distance', label: 'Measure Distance' },
                { value: 'area', label: 'Measure Area' },
                { value: null, label: 'None' },
              ]}
            />
            <Toggle label="Show Scale Bar" checked={showScale} onChange={onShowScaleChange} />
            <TextButton onClick={() => alert('Measurement settings coming soon')}>
              Measurement Settings →
            </TextButton>
          </MenuSection>

          {/* 3. Map Settings Section */}
          <MenuSection icon={Settings} title="Map Settings">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Map Type</label>
                <SegmentedControl
                  value={mapType}
                  options={[
                    { value: 'map', label: 'Map' },
                    { value: 'climate', label: 'Climate' },
                    { value: 'terrain', label: 'Terrain' },
                  ]}
                  onChange={(value) => onMapTypeChange(value as 'map' | 'climate' | 'terrain')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Language</label>
                <select className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow">
                  <option>English</option>
                  <option disabled>Local Names (Coming soon)</option>
                </select>
              </div>
            </div>
          </MenuSection>

          {/* 4. View Options Section */}
          <MenuSection icon={Eye} title="View Options">
            <Toggle label="Show Labels" checked={showLabels} onChange={onShowLabelsChange} />
            <Toggle label="Show Borders" checked={showBorders} onChange={onShowBordersChange} />
            <Toggle
              label="3D Buildings"
              checked={false}
              onChange={() => {}}
              disabled
              hint="Coming soon"
            />
            <Toggle
              label="Dark Mode"
              checked={false}
              onChange={() => {}}
              disabled
              hint="Coming soon"
            />
          </MenuSection>

          {/* 5. Export & Share Section */}
          <MenuSection icon={Download} title="Export & Share">
            <MenuButton
              icon={Download}
              label="Export to PNG"
              onClick={() => alert('PNG export coming soon')}
            />
            <MenuButton
              icon={FileJson}
              label="Export to GeoJSON"
              onClick={() => alert('GeoJSON export coming soon')}
            />
            <MenuButton
              icon={Share2}
              label="Share Link"
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url);
                alert('Link copied to clipboard!');
              }}
            />
            <MenuButton
              icon={Code}
              label="Embed Code"
              onClick={() => alert('Embed code coming soon')}
            />
          </MenuSection>

          {/* 6. Help & Info Section */}
          <MenuSection icon={HelpCircle} title="Help & Info">
            <MenuButton
              icon={Keyboard}
              label="Keyboard Shortcuts"
              onClick={() => alert('Keyboard shortcuts:\n\nESC - Close menu\nM - Toggle measurement\nL - Toggle layers\nS - Toggle scale bar')}
            />
            <MenuButton
              icon={HelpCircle}
              label="Tutorial"
              onClick={() => alert('Interactive tutorial coming soon')}
            />
            <MenuButton
              icon={Info}
              label="About IxMaps"
              onClick={() => alert('IxMaps v1.0\nInteractive mapping platform for IxWiki')}
            />
            <MenuButton
              icon={AlertCircle}
              label="Report Issue"
              onClick={() => window.open('https://github.com/yourusername/ixstats/issues', '_blank')}
            />
          </MenuSection>
        </div>
      </div>
    </>
  );
}

GoogleHamburgerMenu.displayName = 'GoogleHamburgerMenu';

export default memo(GoogleHamburgerMenu);

// ============================================================================
// Reusable Components
// ============================================================================

interface MenuSectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}

function MenuSection({ icon: Icon, title, children }: MenuSectionProps) {
  return (
    <div className="border-b border-gray-200 px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-gray-600" />
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

function Toggle({ label, checked, onChange, disabled, hint }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex-1">
        <label
          className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'} ${!disabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        >
          {label}
        </label>
        {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          disabled
            ? 'bg-gray-200 cursor-not-allowed'
            : checked
              ? 'bg-blue-600'
              : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

interface RadioGroupProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: Array<{ value: string | null; label: string }>;
}

function RadioGroup({ value, onChange, options }: RadioGroupProps) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <div key={String(option.value)} className="flex items-center">
          <input
            type="radio"
            id={`radio-${String(option.value)}`}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label
            htmlFor={`radio-${String(option.value)}`}
            className="ml-2 text-sm text-gray-700 cursor-pointer"
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
}

interface SegmentedControlProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function SegmentedControl({ value, options, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-1 w-full">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all ${
            value === option.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface MenuButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

function MenuButton({ icon: Icon, label, onClick }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-transparent hover:bg-gray-100 transition-colors text-left"
    >
      <Icon className="h-5 w-5 text-gray-600 flex-shrink-0" />
      <span className="text-sm text-gray-700">{label}</span>
    </button>
  );
}

interface TextButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

function TextButton({ onClick, children }: TextButtonProps) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-blue-600 hover:text-blue-700 transition-colors mt-1"
    >
      {children}
    </button>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Load saved settings from localStorage
 */
export function loadMapSettings() {
  if (typeof window === 'undefined') return null;

  const saved = localStorage.getItem(SETTINGS_KEY);
  if (!saved) return null;

  try {
    return JSON.parse(saved) as {
      layers: {
        boundaries: boolean;
        subdivisions: boolean;
        cities: boolean;
        pois: boolean;
      };
      showScale: boolean;
      showLabels: boolean;
      showBorders: boolean;
      mapType: 'map' | 'climate' | 'terrain';
      projection: ProjectionType;
      measurementMode: 'distance' | 'area' | null;
    };
  } catch {
    return null;
  }
}

/**
 * Get default map settings
 */
export function getDefaultMapSettings() {
  return {
    layers: {
      boundaries: true,
      subdivisions: false,
      cities: true,
      pois: true,
    },
    showScale: true,
    showLabels: true,
    showBorders: true,
    mapType: 'map' as const,
    projection: 'globe' as ProjectionType,
    measurementMode: null as null,
  };
}

// Note: The internal sub-components (MenuSection, Toggle, RadioGroup, etc.)
// don't need React.memo as they're only used within GoogleHamburgerMenu
