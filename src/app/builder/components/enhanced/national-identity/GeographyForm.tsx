"use client";

import React from 'react';
import { MapIcon, Clock, Phone, Wifi, Car, Calendar } from 'lucide-react';
import { EnhancedNumberInput, EnhancedToggle } from '../../../primitives/enhanced';
import type { NationalIdentityData } from '~/app/builder/lib/economy-data-service';

interface GeographyFormProps {
  identity: NationalIdentityData;
  onIdentityChange: (field: keyof NationalIdentityData, value: any) => void;
}

export function GeographyForm({ identity, onIdentityChange }: GeographyFormProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <EnhancedNumberInput
        label="Calling Code"
        description="International dialing code"
        value={String(identity.callingCode || '')}
        onChange={(value) => onIdentityChange('callingCode', String(value))}
        sectionId="symbols"
        icon={Phone}
        showButtons={false}
        placeholder="+1, +44, +33..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="Internet TLD"
        description="Top-level domain"
        value={String(identity.internetTLD || '')}
        onChange={(value) => onIdentityChange('internetTLD', String(value))}
        sectionId="symbols"
        icon={Wifi}
        showButtons={false}
        placeholder=".us, .uk, .fr..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="ISO Country Code"
        description="ISO 3166-1 alpha-2 code"
        value={String(identity.isoCode || '')}
        onChange={(value) => onIdentityChange('isoCode', String(value))}
        sectionId="symbols"
        icon={MapIcon}
        showButtons={false}
        placeholder="US, GB, FR..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="Time Zone"
        description="Primary time zone"
        value={String(identity.timeZone || '')}
        onChange={(value) => onIdentityChange('timeZone', String(value))}
        sectionId="symbols"
        icon={Clock}
        showButtons={false}
        placeholder="UTC-5, GMT+1, PST..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="Emergency Number"
        description="Emergency services number"
        value={String(identity.emergencyNumber || '')}
        onChange={(value) => onIdentityChange('emergencyNumber', String(value))}
        sectionId="symbols"
        icon={Phone}
        showButtons={false}
        placeholder="911, 999, 112..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="Postal Code Format"
        description="Postal code pattern"
        value={String(identity.postalCodeFormat || '')}
        onChange={(value) => onIdentityChange('postalCodeFormat', String(value))}
        sectionId="symbols"
        showButtons={false}
        placeholder="12345, SW1A 1AA, etc."
        acceptText={true}
      />

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Car className="h-4 w-4" />
          Driving Side
        </label>
        <EnhancedToggle
          label="Right-hand traffic"
          description="Toggle for left-hand traffic"
          checked={identity.drivingSide === 'right'}
          onChange={(checked) => onIdentityChange('drivingSide', checked ? 'right' : 'left')}
          sectionId="symbols"
          variant="switch"
          showIcons={true}
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Calendar className="h-4 w-4" />
          Week Start Day
        </label>
        <select
          value={identity.weekStartDay || 'monday'}
          onChange={(e) => onIdentityChange('weekStartDay', e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
        >
          <option value="monday">Monday</option>
          <option value="sunday">Sunday</option>
          <option value="saturday">Saturday</option>
        </select>
      </div>

      <EnhancedNumberInput
        label="National Sport"
        description="Most popular or official sport"
        value={String(identity.nationalSport || '')}
        onChange={(value) => onIdentityChange('nationalSport', String(value))}
        sectionId="symbols"
        showButtons={false}
        placeholder="Football, Cricket, Hockey..."
        acceptText={true}
      />

      <div className="lg:col-span-3">
        <h5 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <MapIcon className="h-4 w-4" />
          Geographic Coordinates (Capital City)
        </h5>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnhancedNumberInput
            label="Latitude"
            description="North-South position (-90 to 90)"
            value={String(identity.coordinatesLatitude || '')}
            onChange={(value) => onIdentityChange('coordinatesLatitude', String(value))}
            sectionId="symbols"
            showButtons={false}
            placeholder="40.7128"
            acceptText={true}
          />

          <EnhancedNumberInput
            label="Longitude"
            description="East-West position (-180 to 180)"
            value={String(identity.coordinatesLongitude || '')}
            onChange={(value) => onIdentityChange('coordinatesLongitude', String(value))}
            sectionId="symbols"
            showButtons={false}
            placeholder="-74.0060"
            acceptText={true}
          />
        </div>
      </div>
    </div>
  );
}
