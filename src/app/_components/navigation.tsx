// src/app/_components/navigation.tsx - Updated to include Economy page
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, BarChart3, Globe, Settings, Database, Building } from "lucide-react";
import { useTheme } from "~/context/theme-context";

export function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/ixstats",
      icon: BarChart3,
    },
    {
      name: "Countries",
      href: "/countries",
      icon: Globe,
    },
    {
      name: "Economy Builder", // New Economy page
      href: "/economy",
      icon: Building,
    },
    {
      name: "DM Controls",
      href: "/dm-dashboard",
      icon: Database,
    },
    {
      name: "Admin",
      href: "/admin",
      icon: Settings,
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
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const current = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      current
                        ? "border-indigo-500 dark:border-indigo-400 text-gray-900 dark:text-white"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                    aria-current={current ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 mr-2" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
           
          </div>
        </div>
      </div>
    </nav>
  );
}