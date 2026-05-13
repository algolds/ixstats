import { Palette, Sun, Moon, Monitor } from "lucide-react";
import { AnimatedThemeToggler } from "~/components/magicui/animated-theme-toggler";

interface UserPreferencesCardProps {
  theme: string;
  onThemeChange: (theme: "light" | "dark" | "system") => void;
}

export function UserPreferencesCard({ theme, onThemeChange }: UserPreferencesCardProps) {
  return (
    <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Palette className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Display Configuration</h2>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/50 p-1 dark:border-slate-800 dark:bg-slate-900/50">
            <AnimatedThemeToggler className="h-9 w-9" />
          </div>
        </div>

        <div className="space-y-6">
          <div>
          
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => onThemeChange("light")}
                className={`glass-interactive flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 transition-all ${
                  theme === "light"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                    : "border-slate-200 bg-white/30 text-slate-600 hover:bg-white dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Sun className={`h-5 w-5 ${theme === "light" ? "animate-spin-slow" : ""}`} />
                <span className="text-xs font-bold uppercase tracking-widest">Light</span>
              </button>
              <button
                onClick={() => onThemeChange("dark")}
                className={`glass-interactive flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 transition-all ${
                  theme === "dark"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                    : "border-slate-200 bg-white/30 text-slate-600 hover:bg-white dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Moon className={`h-5 w-5 ${theme === "dark" ? "animate-pulse" : ""}`} />
                <span className="text-xs font-bold uppercase tracking-widest">Dark</span>
              </button>
              <button
                onClick={() => onThemeChange("system")}
                className={`glass-interactive flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 transition-all ${
                  theme === "system"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                    : "border-slate-200 bg-white/30 text-slate-600 hover:bg-white dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Monitor className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-widest">Auto</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
