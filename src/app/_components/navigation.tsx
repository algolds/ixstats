// src/app/_components/navigation.tsx
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
      href: "/dashboard",
      icon: BarChart3,
    },
    {
      name: "Countries",
      href: "/countries",
      icon: Globe,
    },
    {
      name: "Economy Builder",
      href: "/builder",
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

  const isCurrentPage = (href: string) => {
    return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  };

  return (
    <nav className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-surface)] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link
                href="/"
                className="text-2xl font-bold text-gradient hover:opacity-80 transition-opacity"
              >
                IxStats™
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const current = isCurrentPage(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`nav-link ${current ? 'active' : ''}`}
                    aria-current={current ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 mr-2" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center">
            <button
              onClick={toggleTheme}
              className="btn-secondary p-2 rounded-md"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="sm:hidden border-t border-[var(--color-border-primary)]">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const current = isCurrentPage(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`nav-link block w-full ${current ? 'active' : ''}`}
                aria-current={current ? "page" : undefined}
              >
                <Icon className="h-4 w-4 mr-2 inline" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}