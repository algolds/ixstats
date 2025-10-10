"use client";

import React, { useState, useEffect } from 'react';
import { MediaSearchModal } from '~/components/MediaSearchModal';
import { CountrySymbolsUploader } from '../CountrySymbolsUploader';
import { EnhancedNumberInput, EnhancedSlider, EnhancedToggle, MetricCard, CurrencySymbolPicker } from '../../primitives/enhanced';
import { 
  Flag, 
  Globe, 
  Users, 
  Building, 
  Crown, 
  MapPin, 
  Coins, 
  Languages,
  Landmark,
  Heart,
  Calendar,
  Clock,
  MapIcon,
  Wifi,
  Car,
  Plane,
  Phone
} from 'lucide-react';
import type { EconomicInputs, RealCountryData } from '~/app/builder/lib/economy-data-service';
import { useBuilderTheming } from '~/hooks/useBuilderTheming';
import { useCountryFlag } from '~/hooks/useCountryFlags';
import { wikiCommonsFlagService } from '~/lib/wiki-commons-flag-service';

interface NationalIdentitySectionProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
}

// Government type options
const GOVERNMENT_TYPES = [
  { value: 'republic', label: 'Republic', prefix: 'The Republic of' },
  { value: 'kingdom', label: 'Kingdom', prefix: 'The Kingdom of' },
  { value: 'federation', label: 'Federation', prefix: 'The Federation of' },
  { value: 'commonwealth', label: 'Commonwealth', prefix: 'The Commonwealth of' },
  { value: 'emirate', label: 'Emirate', prefix: 'The Emirate of' },
  { value: 'principality', label: 'Principality', prefix: 'The Principality of' },
  { value: 'holy', label: 'Holy State', prefix: 'The Holy' },
  { value: 'union', label: 'Union', prefix: 'The Union of' },
  { value: 'empire', label: 'Empire', prefix: 'The Empire of' },
  { value: 'sultanate', label: 'Sultanate', prefix: 'The Sultanate of' },
  { value: 'duchy', label: 'Duchy', prefix: 'The Duchy of' },
  { value: 'confederacy', label: 'Confederacy', prefix: 'The Confederacy of' },
  { value: 'alliance', label: 'Alliance', prefix: 'The Alliance of' },
  { value: 'coalition', label: 'Coalition', prefix: 'The Coalition of' },
  { value: 'dominion', label: 'Dominion', prefix: 'The Dominion of' },
  { value: 'territories', label: 'Territories', prefix: 'The Territories of' },
  { value: 'protectorate', label: 'Protectorate', prefix: 'The Protectorate of' },
  { value: 'mandate', label: 'Mandate', prefix: 'The Mandate of' },
  { value: 'city-state', label: 'City-State', prefix: 'The City-State of' },
  { value: 'free-state', label: 'Free State', prefix: 'The Free State of' },
  { value: 'socialist-republic', label: 'Socialist Republic', prefix: 'The Socialist Republic of' },
  { value: 'democratic-republic', label: 'Democratic Republic', prefix: 'The Democratic Republic of' },
  { value: 'people-republic', label: 'People\'s Republic', prefix: 'The People\'s Republic of' },
  { value: 'autonomous-region', label: 'Autonomous Region', prefix: 'The Autonomous Region of' },
  { value: 'sovereign-state', label: 'Sovereign State', prefix: 'The Sovereign State of' },
  { value: 'nation', label: 'Nation', prefix: 'The Nation of' },
  { value: 'country', label: 'Country', prefix: 'The Country of' },
  { value: 'state', label: 'State', prefix: 'The State of' },
  { value: 'custom', label: 'Custom', prefix: '' }
];

// Get the original foundation country name for Wiki Commons API calls
function getFoundationCountryName(referenceCountry: RealCountryData | null | undefined): string | null {
  if (!referenceCountry) {
    return null;
  }

  if (referenceCountry.foundationCountryName) {
    return referenceCountry.foundationCountryName;
  }

  const name = referenceCountry.name;
  if (name.startsWith('New ')) {
    return name.substring(4);
  }

  return name;
}

export function NationalIdentitySection({
  inputs,
  onInputsChange,
  referenceCountry,
}: NationalIdentitySectionProps) {
  const [showFlagImageModal, setShowFlagImageModal] = useState(false);
  const [showCoatOfArmsImageModal, setShowCoatOfArmsImageModal] = useState(false);
  const foundationCountryName = getFoundationCountryName(referenceCountry);
  const { flag } = useCountryFlag(foundationCountryName || '');
  const [foundationCoatOfArmsUrl, setFoundationCoatOfArmsUrl] = useState<string | undefined>(undefined);
  const [selectedGovernmentType, setSelectedGovernmentType] = useState('republic');
  const [customOfficialName, setCustomOfficialName] = useState('');

  // Sync local state with loaded identity data
  useEffect(() => {
    console.log('=== NationalIdentitySection - Received inputs.nationalIdentity ===');
    console.log(inputs.nationalIdentity);

    if (inputs.nationalIdentity?.governmentType) {
      console.log('Setting governmentType to:', inputs.nationalIdentity.governmentType);
      setSelectedGovernmentType(inputs.nationalIdentity.governmentType);
    }
    if (inputs.nationalIdentity?.officialName) {
      console.log('Setting officialName to:', inputs.nationalIdentity.officialName);
      setCustomOfficialName(inputs.nationalIdentity.officialName);
    }
  }, [inputs.nationalIdentity]);

  // Initialize identity data structure if it doesn't exist
  const identity = inputs.nationalIdentity || {
    countryName: String(inputs.countryName || ''),
    officialName: '',
    governmentType: 'republic',
    motto: '',
    mottoNative: '',
    capitalCity: '',
    largestCity: '',
    demonym: '',
    currency: '',
    currencySymbol: '$',
    officialLanguages: '',
    nationalLanguage: '',
    nationalAnthem: '',
    nationalReligion: '',
    nationalDay: '',
    callingCode: '',
    internetTLD: '',
    drivingSide: 'right',
    timeZone: '',
    isoCode: '',
    coordinatesLatitude: '',
    coordinatesLongitude: '',
    emergencyNumber: '',
    postalCodeFormat: '',
    nationalSport: '',
    weekStartDay: 'monday'
  };

  // Fetch coat of arms
  useEffect(() => {
    const fetchCoatOfArms = async () => {
      if (foundationCountryName) {
        try {
          const coatOfArmsResult = await wikiCommonsFlagService.getCoatOfArmsUrl(foundationCountryName);
          if (coatOfArmsResult) {
            setFoundationCoatOfArmsUrl(coatOfArmsResult);
          }
        } catch (error) {
          console.error('Error fetching coat of arms:', error);
        }
      }
    };
    fetchCoatOfArms();
  }, [foundationCountryName]);

  // Auto-fill flag and coat of arms from foundation country when available
  useEffect(() => {
    if (flag?.flagUrl && (!inputs.flagUrl || inputs.flagUrl === '')) {
      handleFlagUrlChange(flag.flagUrl);
    }
    if (foundationCoatOfArmsUrl && (!inputs.coatOfArmsUrl || inputs.coatOfArmsUrl === '')) {
      handleCoatOfArmsUrlChange(foundationCoatOfArmsUrl);
    }
  }, [flag?.flagUrl, foundationCoatOfArmsUrl, inputs.flagUrl, inputs.coatOfArmsUrl]);

  const { handleColorsExtracted } = useBuilderTheming(foundationCountryName || '');

  const handleIdentityChange = (field: keyof typeof identity, value: any) => {
    const newIdentity = { ...identity, [field]: value };
    
    // Auto-generate demonym if country name changes
    if (field === 'countryName' && value) {
      if (!newIdentity.demonym) {
        // Simple demonym generation (can be improved)
        let demonym = value.toString();
        if (demonym.endsWith('a')) demonym += 'n';
        else if (demonym.endsWith('y')) demonym = demonym.slice(0, -1) + 'ian';
        else demonym += 'ian';
        newIdentity.demonym = demonym;
      }
    }

    // Auto-generate official name based on government type
    if (field === 'governmentType' || field === 'countryName') {
      if (newIdentity.governmentType !== 'custom') {
        const govType = GOVERNMENT_TYPES.find(t => t.value === newIdentity.governmentType);
        if (govType) {
          newIdentity.officialName = `${govType.prefix} ${newIdentity.countryName}`;
        }
      }
    }

    onInputsChange({
      ...inputs,
      nationalIdentity: newIdentity,
      countryName: field === 'countryName' ? value : inputs.countryName
    });
  };

  const handleSymbolsChange = (flagUrl: string, coatOfArmsUrl: string) => {
    onInputsChange({
      ...inputs,
      flagUrl,
      coatOfArmsUrl,
    });
  };

  const handleFlagUrlChange = (url: string) => {
    handleSymbolsChange(url, inputs.coatOfArmsUrl ?? '');
  };

  const handleCoatOfArmsUrlChange = (url: string) => {
    handleSymbolsChange(inputs.flagUrl ?? '', url);
  };

  // Create a selector component for government type
  const GovernmentTypeSelector = () => (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Crown className="h-4 w-4" />
        Government Type
      </label>
      <select
        value={selectedGovernmentType}
        onChange={(e) => {
          setSelectedGovernmentType(e.target.value);
          handleIdentityChange('governmentType', e.target.value);
        }}
        className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200 hover:bg-accent/5"
      >
        {GOVERNMENT_TYPES.map(type => (
          <option
            key={type.value}
            value={type.value}
            className="bg-background text-foreground"
          >
            {type.label}
          </option>
        ))}
      </select>
      {selectedGovernmentType === 'custom' && (
        <input
          type="text"
          value={customOfficialName}
          onChange={(e) => {
            setCustomOfficialName(e.target.value);
            handleIdentityChange('officialName', e.target.value);
          }}
          placeholder="Enter custom official name..."
          className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
        />
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-8">
        {/* National Symbols */}
        <div className="rounded-lg border border-border bg-card p-6">
          <CountrySymbolsUploader
            flagUrl={inputs.flagUrl ?? ''}
            coatOfArmsUrl={inputs.coatOfArmsUrl ?? ''}
            foundationCountry={foundationCountryName ? {
              name: foundationCountryName,
              flagUrl: flag?.flagUrl ?? '',
              coatOfArmsUrl: foundationCoatOfArmsUrl
            } : undefined}
            onSelectFlag={() => setShowFlagImageModal(true)}
            onSelectCoatOfArms={() => setShowCoatOfArmsImageModal(true)}
            onFlagUrlChange={handleFlagUrlChange}
            onCoatOfArmsUrlChange={handleCoatOfArmsUrlChange}
            onColorsExtracted={(colors) => {
              handleColorsExtracted(colors);
            }}
          />
        </div>

        {/* Basic Identity Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnhancedNumberInput
            label="Country Name"
            value={String(identity.countryName || '')}
            onChange={(value) => handleIdentityChange('countryName', String(value))}
            sectionId="symbols"
            icon={Globe}
            showButtons={false}
            placeholder="Enter country name"
            acceptText={true}
          />

          <GovernmentTypeSelector />

          <div className="lg:col-span-2">
            <EnhancedNumberInput
              label="Official Name"
              description="Full ceremonial name of the country"
              value={String(identity.officialName || '')}
              onChange={(value) => handleIdentityChange('officialName', String(value))}
              sectionId="symbols"
              icon={Crown}
              showButtons={false}
              placeholder="The Republic of..."
              acceptText={true}
            />
          </div>

          <EnhancedNumberInput
            label="Capital City"
            value={String(identity.capitalCity || '')}
            onChange={(value) => handleIdentityChange('capitalCity', String(value))}
            sectionId="symbols"
            icon={Building}
            showButtons={false}
            placeholder="Capital city name"
            acceptText={true}
          />

          <EnhancedNumberInput
            label="Largest City"
            value={String(identity.largestCity || '')}
            onChange={(value) => handleIdentityChange('largestCity', String(value))}
            sectionId="symbols"
            icon={MapPin}
            showButtons={false}
            placeholder="Largest city name"
            acceptText={true}
          />

          <EnhancedNumberInput
            label="Demonym"
            description="What citizens are called (e.g., American, French)"
            value={String(identity.demonym || '')}
            onChange={(value) => handleIdentityChange('demonym', String(value))}
            sectionId="symbols"
            icon={Users}
            showButtons={false}
            placeholder="Demonym"
            acceptText={true}
          />

          <div className="space-y-4">
            <EnhancedNumberInput
              label="Currency"
              value={String(identity.currency || '')}
              onChange={(value) => handleIdentityChange('currency', String(value))}
              sectionId="symbols"
              icon={Coins}
              showButtons={false}
              placeholder="Dollar, Euro, etc."
              acceptText={true}
            />
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Coins className="h-4 w-4" />
                Currency Symbol
              </label>
              <CurrencySymbolPicker
                value={identity.currencySymbol || '$'}
                onSymbolSelect={(symbol) => handleIdentityChange('currencySymbol', symbol)}
                sectionId="symbols"
              />
            </div>
          </div>
        </div>

        {/* National Mottos */}
        <div className="space-y-4">
          <h4 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Heart className="h-5 w-5" />
            National Mottos
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedNumberInput
              label="National Motto (English)"
              value={String(identity.motto || '')}
              onChange={(value) => handleIdentityChange('motto', String(value))}
              sectionId="symbols"
              showButtons={false}
              placeholder="E pluribus unum, Liberty, Equality, Fraternity..."
              acceptText={true}
            />

            <EnhancedNumberInput
              label="National Motto (Native Language)"
              value={String(identity.mottoNative || '')}
              onChange={(value) => handleIdentityChange('mottoNative', String(value))}
              sectionId="symbols"
              showButtons={false}
              placeholder="Original language version"
              acceptText={true}
            />
          </div>
        </div>

        {/* Languages and Culture */}
        <div className="space-y-4">
          <h4 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Languages & Culture
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedNumberInput
              label="Official Languages"
              description="Comma-separated list of official languages"
              value={String(identity.officialLanguages || '')}
              onChange={(value) => handleIdentityChange('officialLanguages', String(value))}
              sectionId="symbols"
              showButtons={false}
              placeholder="English, Spanish, French..."
              acceptText={true}
            />

            <EnhancedNumberInput
              label="National Language"
              description="Primary/most spoken language"
              value={String(identity.nationalLanguage || '')}
              onChange={(value) => handleIdentityChange('nationalLanguage', String(value))}
              sectionId="symbols"
              showButtons={false}
              placeholder="Primary language"
              acceptText={true}
            />

            <EnhancedNumberInput
              label="National Anthem"
              value={String(identity.nationalAnthem || '')}
              onChange={(value) => handleIdentityChange('nationalAnthem', String(value))}
              sectionId="symbols"
              showButtons={false}
              placeholder="Name of national anthem"
              acceptText={true}
            />

            <EnhancedNumberInput
              label="National Religion"
              description="Primary or state religion (if applicable)"
              value={String(identity.nationalReligion || '')}
              onChange={(value) => handleIdentityChange('nationalReligion', String(value))}
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
              onChange={(value) => handleIdentityChange('nationalDay', String(value))}
              sectionId="symbols"
              showButtons={false}
              placeholder="July 4th, December 1st..."
              acceptText={true}
            />
          </div>
        </div>

        {/* Technical Information */}
        <div className="space-y-4">
          <h4 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Technical Details
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <EnhancedNumberInput
              label="Calling Code"
              description="International dialing code"
              value={String(identity.callingCode || '')}
              onChange={(value) => handleIdentityChange('callingCode', String(value))}
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
              onChange={(value) => handleIdentityChange('internetTLD', String(value))}
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
              onChange={(value) => handleIdentityChange('isoCode', String(value))}
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
              onChange={(value) => handleIdentityChange('timeZone', String(value))}
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
              onChange={(value) => handleIdentityChange('emergencyNumber', String(value))}
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
              onChange={(value) => handleIdentityChange('postalCodeFormat', String(value))}
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
                onChange={(checked) => handleIdentityChange('drivingSide', checked ? 'right' : 'left')}
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
                onChange={(e) => handleIdentityChange('weekStartDay', e.target.value)}
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
              onChange={(value) => handleIdentityChange('nationalSport', String(value))}
              sectionId="symbols"
              showButtons={false}
              placeholder="Football, Cricket, Hockey..."
              acceptText={true}
            />
          </div>

          {/* Geographic Coordinates */}
          <div className="mt-6">
            <h5 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
              <MapIcon className="h-4 w-4" />
              Geographic Coordinates (Capital City)
            </h5>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EnhancedNumberInput
                label="Latitude"
                description="North-South position (-90 to 90)"
                value={String(identity.coordinatesLatitude || '')}
                onChange={(value) => handleIdentityChange('coordinatesLatitude', String(value))}
                sectionId="symbols"
                showButtons={false}
                placeholder="40.7128"
                acceptText={true}
              />

              <EnhancedNumberInput
                label="Longitude"
                description="East-West position (-180 to 180)"
                value={String(identity.coordinatesLongitude || '')}
                onChange={(value) => handleIdentityChange('coordinatesLongitude', String(value))}
                sectionId="symbols"
                showButtons={false}
                placeholder="-74.0060"
                acceptText={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal components */}
      {showFlagImageModal && (
        <MediaSearchModal
          isOpen={showFlagImageModal}
          onClose={() => setShowFlagImageModal(false)}
          onImageSelect={(url) => {
            handleFlagUrlChange(url);
            setShowFlagImageModal(false);
          }}
        />
      )}
      {showCoatOfArmsImageModal && (
        <MediaSearchModal
          isOpen={showCoatOfArmsImageModal}
          onClose={() => setShowCoatOfArmsImageModal(false)}
          onImageSelect={(url) => {
            handleCoatOfArmsUrlChange(url);
            setShowCoatOfArmsImageModal(false);
          }}
        />
      )}
    </>
  );
}