"use client";

import React from 'react';
import { Languages, Heart } from 'lucide-react';
import { EnhancedNumberInput } from '../../../primitives/enhanced';
import type { NationalIdentityData } from '~/app/builder/lib/economy-data-service';

interface CultureFormProps {
  identity: NationalIdentityData;
  onIdentityChange: (field: keyof NationalIdentityData, value: any) => void;
  IdentityAutocomplete: React.ComponentType<any>;
}

export function CultureForm({ identity, onIdentityChange, IdentityAutocomplete }: CultureFormProps) {
  return (
    <>
      {/* Mottos Section */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">National Mottos</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnhancedNumberInput
            label="National Motto (English)"
            value={String(identity.motto || '')}
            onChange={(value) => onIdentityChange('motto', String(value))}
            sectionId="symbols"
            showButtons={false}
            placeholder="E pluribus unum, Liberty, Equality, Fraternity..."
            acceptText={true}
          />

          <EnhancedNumberInput
            label="National Motto (Native Language)"
            value={String(identity.mottoNative || '')}
            onChange={(value) => onIdentityChange('mottoNative', String(value))}
            sectionId="symbols"
            showButtons={false}
            placeholder="Original language version"
            acceptText={true}
          />
        </div>
      </div>

      {/* Languages & Culture Section */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Languages & Culture</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IdentityAutocomplete
            fieldName="officialLanguages"
            value={String(identity.officialLanguages || '')}
            onChange={(value: string) => onIdentityChange('officialLanguages', value)}
            placeholder="English, Spanish, French..."
            icon={Languages}
          />

          <IdentityAutocomplete
            fieldName="nationalLanguage"
            value={String(identity.nationalLanguage || '')}
            onChange={(value: string) => onIdentityChange('nationalLanguage', value)}
            placeholder="Primary language"
            icon={Languages}
          />

          <EnhancedNumberInput
            label="National Anthem"
            value={String(identity.nationalAnthem || '')}
            onChange={(value) => onIdentityChange('nationalAnthem', String(value))}
            sectionId="symbols"
            showButtons={false}
            placeholder="Name of national anthem"
            acceptText={true}
          />

          <EnhancedNumberInput
            label="National Religion"
            description="Primary or state religion (if applicable)"
            value={String(identity.nationalReligion || '')}
            onChange={(value) => onIdentityChange('nationalReligion', String(value))}
            sectionId="symbols"
            icon={Heart}
            showButtons={false}
            placeholder="e.g., Christianity, Islam, Buddhism, Secular..."
            acceptText={true}
          />

          <EnhancedNumberInput
            label="National Day"
            description="Independence or national celebration day"
            value={String(identity.nationalDay || '')}
            onChange={(value) => onIdentityChange('nationalDay', String(value))}
            sectionId="symbols"
            showButtons={false}
            placeholder="July 4th, December 1st..."
            acceptText={true}
          />
        </div>
      </div>
    </>
  );
}
