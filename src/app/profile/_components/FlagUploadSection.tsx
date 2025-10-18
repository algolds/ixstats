import { Flag, Upload } from "lucide-react";

interface FlagUploadSectionProps {
  uploadedFlagUrl: string | null;
  isUploadingFlag: boolean;
  updateCountryFlagMutation: any;
  onFlagUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFlagSave: () => void;
  onCancel: () => void;
}

export function FlagUploadSection({
  uploadedFlagUrl,
  isUploadingFlag,
  updateCountryFlagMutation,
  onFlagUpload,
  onFlagSave,
  onCancel
}: FlagUploadSectionProps) {
  return (
    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
      <div className="flex items-center gap-2 mb-3">
        <Flag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h4 className="font-medium text-blue-900 dark:text-blue-100">Custom Flag Upload</h4>
      </div>
      <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
        Upload a custom flag for your country. This will override the automatic wiki flag if found.
      </p>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className={`cursor-pointer ${isUploadingFlag ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="file"
              accept="image/*"
              onChange={onFlagUpload}
              className="hidden"
              disabled={isUploadingFlag}
            />
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors">
              <Upload className="h-4 w-4" />
              <span className="text-sm font-medium">
                {isUploadingFlag ? 'Uploading...' : 'Choose File'}
              </span>
            </div>
          </label>
          {uploadedFlagUrl && !isUploadingFlag && (
            <div className="flex items-center gap-2">
              <img
                src={uploadedFlagUrl}
                alt="Flag preview"
                className="h-8 w-auto rounded border shadow-sm"
              />
              <button
                onClick={onFlagSave}
                disabled={updateCountryFlagMutation.isPending}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm rounded"
              >
                {updateCountryFlagMutation.isPending ? 'Saving...' : 'Save Flag'}
              </button>
              <button
                onClick={onCancel}
                disabled={updateCountryFlagMutation.isPending}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm rounded"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          Supported formats: PNG, JPG, GIF, WEBP, SVG • Max size: 5MB • Recommended dimensions: 2:3 ratio
        </p>
      </div>
    </div>
  );
}
