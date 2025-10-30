import { Palette, Sun, Moon, Monitor } from "lucide-react";
import { AnimatedThemeToggler } from "~/components/magicui/animated-theme-toggler";

interface UserPreferencesCardProps {
  theme: string;
  onThemeChange: (theme: "light" | "dark" | "system") => void;
}

export function UserPreferencesCard({ theme, onThemeChange }: UserPreferencesCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center">
        <Palette className="mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Preferences</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Theme
          </label>
          <div className="flex items-center justify-between">
            <div className="grid flex-1 grid-cols-3 gap-3">
              <button
                onClick={() => onThemeChange("light")}
                className={`flex items-center justify-center rounded-lg border px-4 py-3 transition-colors ${
                  theme === "light"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                    : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </button>
              <button
                onClick={() => onThemeChange("dark")}
                className={`flex items-center justify-center rounded-lg border px-4 py-3 transition-colors ${
                  theme === "dark"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                    : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </button>
              <button
                onClick={() => onThemeChange("system")}
                className={`flex items-center justify-center rounded-lg border px-4 py-3 transition-colors ${
                  theme === "system"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                    : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <Monitor className="mr-2 h-4 w-4" />
                System
              </button>
            </div>
            <div className="ml-4">
              <AnimatedThemeToggler className="border border-gray-200 dark:border-gray-700" />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Choose your preferred theme or use the animated toggle. System will follow your
            operating system's theme setting.
          </p>
        </div>
      </div>
    </div>
  );
}
