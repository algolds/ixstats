import { Palette, Sun, Moon, Monitor } from "lucide-react";
import { AnimatedThemeToggler } from "~/components/magicui/animated-theme-toggler";

interface UserPreferencesCardProps {
  theme: string;
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

export function UserPreferencesCard({ theme, onThemeChange }: UserPreferencesCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-4">
        <Palette className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          User Preferences
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Theme
          </label>
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-3 gap-3 flex-1">
              <button
                onClick={() => onThemeChange('light')}
                className={`flex items-center justify-center px-4 py-3 rounded-lg border transition-colors ${
                  theme === 'light'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Sun className="h-4 w-4 mr-2" />
                Light
              </button>
              <button
                onClick={() => onThemeChange('dark')}
                className={`flex items-center justify-center px-4 py-3 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </button>
              <button
                onClick={() => onThemeChange('system')}
                className={`flex items-center justify-center px-4 py-3 rounded-lg border transition-colors ${
                  theme === 'system'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Monitor className="h-4 w-4 mr-2" />
                System
              </button>
            </div>
            <div className="ml-4">
              <AnimatedThemeToggler className="border border-gray-200 dark:border-gray-700" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Choose your preferred theme or use the animated toggle. System will follow your operating system's theme setting.
          </p>
        </div>
      </div>
    </div>
  );
}
