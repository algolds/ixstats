import { Crown, Edit3, Save, X } from "lucide-react";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import { FlagUploadSection } from "./FlagUploadSection";
import CountryFlag from "~/app/_components/CountryFlag";

interface CountryInformationCardProps {
  country: {
    id: string;
    name: string;
    economicTier: string | null;
    currentPopulation: number | null;
    currentGdpPerCapita: number | null;
  };
  uploadedFlagUrl: string | null;
  flagUploadMode: boolean;
  isEditingCountry: boolean;
  newCountryName: string;
  updateCountryNameMutation: any;
  onEditCountry: () => void;
  onUpdateCountryName: () => void;
  onCancelEdit: () => void;
  onSetNewCountryName: (name: string) => void;
  onToggleFlagUpload: () => void;
  onFlagUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFlagSave: () => void;
  onCancelFlagUpload: () => void;
  isUploadingFlag: boolean;
  updateCountryFlagMutation: any;
}

export function CountryInformationCard({
  country,
  uploadedFlagUrl,
  flagUploadMode,
  isEditingCountry,
  newCountryName,
  updateCountryNameMutation,
  onEditCountry,
  onUpdateCountryName,
  onCancelEdit,
  onSetNewCountryName,
  onToggleFlagUpload,
  onFlagUpload,
  onFlagSave,
  onCancelFlagUpload,
  isUploadingFlag,
  updateCountryFlagMutation
}: CountryInformationCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Crown className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            My Country
          </h2>
        </div>
        <Link
          href={createUrl(`/countries/${country.id}`)}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium"
        >
          View Details →
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Country Name
          </label>
          {isEditingCountry ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCountryName}
                onChange={(e) => onSetNewCountryName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                placeholder={country.name}
              />
              <button
                onClick={onUpdateCountryName}
                disabled={updateCountryNameMutation.isPending}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-md disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                onClick={onCancelEdit}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 text-white rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {uploadedFlagUrl ? (
                  <img
                    src={uploadedFlagUrl}
                    alt="Custom flag"
                    className="h-6 w-auto rounded shadow-sm"
                  />
                ) : (
                  <CountryFlag
                    countryCode={country.name.substring(0, 2).toUpperCase()}
                    countryName={country.name}
                    className="rounded shadow-sm"
                  />
                )}
                <p className="text-gray-900 dark:text-white">
                  {country.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleFlagUpload}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  title="Upload custom flag"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={onEditCountry}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                  title="Edit country name"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {flagUploadMode && (
          <FlagUploadSection
            uploadedFlagUrl={uploadedFlagUrl}
            isUploadingFlag={isUploadingFlag}
            updateCountryFlagMutation={updateCountryFlagMutation}
            onFlagUpload={onFlagUpload}
            onFlagSave={onFlagSave}
            onCancel={onCancelFlagUpload}
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Economic Tier
          </label>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            country.economicTier === 'Advanced' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            country.economicTier === 'Developed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
            country.economicTier === 'Emerging' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
          }`}>
            {country.economicTier}
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Population
          </label>
          <p className="text-gray-900 dark:text-white">
            {country.currentPopulation?.toLocaleString() || 'N/A'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            GDP per Capita
          </label>
          <p className="text-gray-900 dark:text-white">
            ${country.currentGdpPerCapita?.toLocaleString() || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}
