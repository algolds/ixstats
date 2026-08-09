"use client";

import Link from "next/link";
import { Compass, User, X, Lightbulb } from "lucide-react";
import { UserProfileMenu } from "~/components/UserProfileMenu";
import type { ContextualMenuDefinition, NavigationItem } from "~/lib/navigation-config";
import { ContextualMenu } from "~/components/navigation/ContextualMenu";

export interface MobileMenuProps {
  contextMenu: ContextualMenuDefinition;
  visibleNavItems: NavigationItem[];
  isCurrentPage: (href: string) => boolean;
  normalizedPathname: string;
  onClose: () => void;
  // Auth section
  user: unknown;
  userProfile: unknown;
  setupStatus: string;
  userCountryFlag: string | null;
  flagsLoading: boolean;
}

/**
 * Inner content of the mobile navigation panel: header, account section, global
 * navigation list, and the page-aware contextual menu. Extracted from
 * navigation.tsx. The keyed AnimatePresence/motion wrappers stay in the
 * orchestrator so exit animations are unchanged.
 */
export function MobileMenu({
  contextMenu,
  visibleNavItems,
  isCurrentPage,
  normalizedPathname,
  onClose,
  user,
  userProfile,
  setupStatus,
  userCountryFlag,
  flagsLoading,
}: MobileMenuProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-muted-foreground/80 text-[10px] tracking-wide uppercase sm:text-[11px]">
            Currently viewing
          </p>
          <h2 className="text-foreground text-base font-semibold break-words sm:text-lg">
            {contextMenu.title}
          </h2>
          {contextMenu.description && (
            <p className="text-muted-foreground text-xs leading-snug break-words sm:text-sm">
              {contextMenu.description}
            </p>
          )}
        </div>
        <button
          type="button"
          className="border-border/50 text-muted-foreground hover:border-foreground/40 hover:text-foreground min-h-[44px] min-w-[44px] shrink-0 rounded-full border p-2 transition-colors"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile Authentication Section */}
      <div className="border-border/40 mt-6 border-b pb-5">
        <div className="mb-3 flex items-center gap-2">
          <User className="text-muted-foreground/70 h-3.5 w-3.5" />
          <p className="text-muted-foreground/80 text-xs font-semibold tracking-wide uppercase">
            Account
          </p>
        </div>
        <div className="bg-accent/5 border-border/30 rounded-xl border p-3">
          <UserProfileMenu
            user={user}
            userProfile={userProfile}
            setupStatus={setupStatus}
            userCountryFlag={userCountryFlag}
            flagsLoading={flagsLoading}
          />
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Compass className="text-muted-foreground/70 h-3.5 w-3.5" />
            <p className="text-muted-foreground/80 text-xs font-semibold tracking-wide uppercase">
              Global navigation
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const current = isCurrentPage(item.href);

              if (item.isDropdown && item.dropdownItems) {
                return (
                  <div
                    key={item.name}
                    className="border-border/50 bg-card/60 rounded-2xl border px-3 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground text-sm font-semibold break-words">
                          {item.name}
                        </p>
                        <p className="text-muted-foreground text-xs break-words">
                          Select a lab to jump in.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {item.dropdownItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        return (
                          <Link
                            key={subItem.name}
                            href={subItem.href}
                            className="text-muted-foreground hover:border-border/60 hover:text-foreground flex min-h-[44px] items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm transition-colors"
                            onClick={onClose}
                          >
                            <span className="bg-muted/50 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                              <SubIcon className="h-4 w-4" />
                            </span>
                            <span className="flex-1 break-words">{subItem.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={`flex min-h-[60px] items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                    current
                      ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                      : "border-border/40 text-muted-foreground hover:border-border hover:bg-accent/10 hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      current ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-semibold break-words">{item.name}</p>
                    {item.description && (
                      <p className="text-muted-foreground text-xs leading-tight break-words">
                        {item.description}
                      </p>
                    )}
                  </div>
                  {current && (
                    <span className="text-primary shrink-0 text-[10px] font-semibold tracking-wide uppercase sm:text-[11px]">
                      Active
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Section Divider */}
        <div className="border-border/40 border-t pt-5">
          <div className="mb-1 flex items-center gap-2">
            <div className="via-border/60 h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
            <span className="text-muted-foreground/60 text-[10px] font-semibold tracking-wider uppercase">
              Context Menu
            </span>
            <div className="via-border/60 h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
          </div>
        </div>

        <ContextualMenu
          contextMenu={contextMenu}
          normalizedPathname={normalizedPathname}
          onNavigate={onClose}
        />
      </div>

      {/* Footer */}
      <div className="mt-8 space-y-3">
        <div className="border-border/60 bg-muted/40 text-muted-foreground rounded-2xl border border-dashed px-4 py-3 text-xs leading-relaxed">
          <span className="font-semibold">
            <Lightbulb className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-amber-400" />
            Smart Navigation:
          </span>{" "}
          This menu adapts to your current page. Use it for rapid jumps across IxStats systems.
        </div>

        {/* Close Button for easier mobile UX */}
        <button
          type="button"
          onClick={onClose}
          className="bg-accent/20 hover:bg-accent/30 text-foreground border-border/40 min-h-[50px] w-full rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
        >
          Close Menu
        </button>
      </div>
    </>
  );
}
