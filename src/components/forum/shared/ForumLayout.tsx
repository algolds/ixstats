"use client";
// Forum content wrapper with icon rail sidebar on desktop, horizontal pills on mobile.
// The rail and pill bar are chrome (material-thin pill bar); the Forum tint (orange) comes
// from data-app="forum" on the route layout.

import { type ReactNode, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HomeSimple as Home,
  FireFlame as Flame,
  Clock,
  Search,
  Bookmark,
  ChatBubble as MessageCircle,
  Reply,
  ShareAndroid as Share2,
  EditPencil as PenSquare,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button, buttonVariants } from "~/components/ui/button";
import { withBasePath } from "~/lib/base-path";
import { stripBasePath } from "~/lib/base-path";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { IXFORUM_VERSION } from "~/lib/buildVersion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { SearchField } from "~/components/ui/search-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

interface ForumNavItem {
  id: string;
  href: string;
  icon: typeof Home;
  title: string;
  contextual?: boolean;
}

const NAV_GROUP_1: ForumNavItem[] = [
  { id: "home", href: "/forum", icon: Home, title: "Forums" },
  { id: "trending", href: "/forum?sort=trending", icon: Flame, title: "Trending" },
  { id: "new-posts", href: "/forum?sort=new", icon: Clock, title: "New posts" },
];

const NAV_GROUP_2: ForumNavItem[] = [
  { id: "stashes", href: "/forum/bookmarks", icon: Bookmark, title: "Stashes" },
  { id: "conversations", href: "/messages", icon: MessageCircle, title: "Messages" },
];

// oxlint-disable-next-line eslint/no-unused-vars
const NAV_GROUP_3: ForumNavItem[] = [
  { id: "search", href: "/forum/search", icon: Search, title: "Search" },
];

function ForumSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      // oxlint-disable-next-line
      setQuery("");
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      onClose();
      router.push(withBasePath(`/forum/search?q=${encodeURIComponent(query)}`));
    }
  };

  // Keyboard-invoked (⌘K): instant presentation; Escape and the close button dismiss.
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        presentation="instant"
        showCloseButton={false}
        className="top-[15vh] translate-y-0 gap-0 p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Search forums</DialogTitle>
        <DialogDescription className="sr-only">
          Type a query and press Enter to search the forums.
        </DialogDescription>
        <div className="border-separator border-b p-3">
          <SearchField
            autoFocus
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleKeyDown}
            placeholder="Search forums..."
            aria-label="Search forums"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <p className="text-footnote text-label-secondary px-4 py-6 text-center">
          Press Enter to search forums
        </p>
      </DialogContent>
    </Dialog>
  );
}

interface ForumLayoutProps {
  children: ReactNode;
}

export function ForumLayout({ children }: ForumLayoutProps) {
  const { currentThread } = useForumContext();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Cmd+K to open search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Page transition animation
  const contentRef = useRef<HTMLElement>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      const el = contentRef.current;
      if (el) {
        el.classList.remove("forum-page-enter");
        void el.offsetWidth;
        el.classList.add("forum-page-enter");
      }
    }
  }, [pathname]);

  // Build contextual nav items for thread view
  const contextualItems: ForumNavItem[] = currentThread
    ? [
        { id: "reply", href: "#reply", icon: Reply, title: "Reply", contextual: true },
        { id: "share", href: "#share", icon: Share2, title: "Share", contextual: true },
      ]
    : [];

  const getActiveId = () => {
    const p = stripBasePath(pathname);
    if (p === "/forum" || p === "/forum/") return "home";
    if (p.includes("/forum/conversations")) return "conversations";
    if (p.includes("/forum/bookmarks")) return "bookmarks";
    if (p.includes("/forum/search")) return "search";
    if (p.includes("/forum/new-thread")) return "new-thread";
    if (p.includes("sort=trending")) return "trending";
    if (p.includes("sort=new")) return "new-posts";
    return null;
  };

  const activeId = getActiveId();

  return (
    <div className="forum-shell relative">
      {/* Mobile: horizontal pill bar. This and the desktop rail are hidden under the new shell,
          where the AppSidebar / TabBar list the same destinations (app-sections.ts). */}
      <nav
        data-app-subnav=""
        aria-label="Forum"
        className="forum-mobile-nav material-thin lg:hidden"
      >
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {NAV_GROUP_1.map((item) => (
            <MobilePill key={item.id} item={item} isActive={activeId === item.id} />
          ))}
          {NAV_GROUP_2.map((item) => (
            <MobilePill key={item.id} item={item} isActive={activeId === item.id} />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchOpen(true)}
            className={pillClassName(false)}
          >
            <Search className="size-3.5 shrink-0" />
            <span className="whitespace-nowrap">Search</span>
          </Button>
          {contextualItems.map((item) => (
            <MobilePill key={item.id} item={item} isActive={false} />
          ))}
        </div>
      </nav>

      <div className="flex">
        {/* Desktop: icon rail */}
        <aside data-app-subnav="" className="forum-icon-rail hidden lg:flex">
          <nav aria-label="Forum" className="flex flex-col gap-1">
            {NAV_GROUP_1.map((item) => (
              <RailIcon key={item.id} item={item} isActive={activeId === item.id} />
            ))}

            <div className="bg-separator mx-auto my-2 h-px w-6" />

            {NAV_GROUP_2.map((item) => (
              <RailIcon key={item.id} item={item} isActive={activeId === item.id} />
            ))}

            <div className="bg-separator mx-auto my-2 h-px w-6" />

            <RailTooltip label="Search (⌘K)">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                aria-keyshortcuts="Meta+K"
                className={railClassName(false)}
              >
                <Search className="size-[18px]" />
              </Button>
            </RailTooltip>

            <RailIcon
              item={{
                id: "new-thread",
                href: "/forum/new-thread",
                icon: PenSquare,
                title: "New thread",
              }}
              isActive={activeId === "new-thread"}
            />

            {/* Contextual (reply/share when in thread) */}
            {contextualItems.length > 0 && (
              <>
                <div className="bg-separator mx-auto my-2 h-px w-6" />
                {contextualItems.map((item) => (
                  <RailIcon key={item.id} item={item} isActive={false} />
                ))}
              </>
            )}
          </nav>
        </aside>

        <main ref={contentRef} className="forum-content min-w-0 flex-1">
          {children}
        </main>
      </div>

      <footer className="forum-main-footer">
        Powered by <strong>IxForum</strong> v{IXFORUM_VERSION}
      </footer>

      <ForumSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

// Rail icons and mobile pills are `ghost` Buttons (links share the classes via `buttonVariants`)
// with tint selection for the current destination.
const railClassName = (isActive: boolean) =>
  cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    "size-10",
    isActive ? "bg-tint-fill text-tint hover:bg-tint/20" : "text-label-secondary hover:text-label"
  );

const pillClassName = (isActive: boolean) =>
  cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "shrink-0 gap-2 rounded-full px-3",
    isActive ? "bg-tint-fill text-tint hover:bg-tint/20" : "text-label-secondary hover:text-label"
  );

function RailTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function RailIcon({ item, isActive }: { item: ForumNavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <RailTooltip label={item.title}>
      <Link
        href={withBasePath(item.href)}
        aria-label={item.title}
        aria-current={isActive ? "page" : undefined}
        className={railClassName(isActive)}
      >
        <Icon className="size-[18px]" />
      </Link>
    </RailTooltip>
  );
}

function MobilePill({ item, isActive }: { item: ForumNavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={withBasePath(item.href)}
      aria-current={isActive ? "page" : undefined}
      className={pillClassName(isActive)}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="whitespace-nowrap">{item.title}</span>
    </Link>
  );
}
