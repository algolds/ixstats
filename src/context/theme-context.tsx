// src/context/theme-context.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme") as Theme;
      if (savedTheme) {
        setTheme(savedTheme);
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    }
  }, []);

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// src/app/_components/navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, BarChart3, Globe, Settings, Database } from "lucide-react";
import { useTheme as useThemeContext } from "~/context/theme-context";

export function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const navigation = [
    {
      name: "Dashboard",
      href: "/ixstats",
      icon: BarChart3,
      current: pathname === "/ixstats",
    },
    {
      name: "Countries",
      href: "/countries",
      icon: Globe,
      current: pathname === "/countries" || pathname.startsWith("/countries/"),
    },
    {
      name: "DM Controls",
      href: "/dm-dashboard",
      icon: Database,
      current: pathname === "/dm-dashboard",
    },
    {
      name: "Admin",
      href: "/admin",
      icon: Settings,
      current: pathname === "/admin",
    },
  ];

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                IxStats™
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      item.current
                        ? "border-indigo-500 text-gray-900 dark:text-white"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-md"
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}