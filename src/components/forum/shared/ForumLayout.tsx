"use client";
// Forum content wrapper. Section navigation (forums, trending, new posts, search, bookmarks,
// new thread) lives in the app sidebar and tab bar; the Forum tint (orange) comes from
// data-app="forum" on the route layout. Cmd+K opens the forum search dialog.

import { type ReactNode, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import { IXFORUM_VERSION } from "~/lib/buildVersion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { SearchField } from "~/components/ui/search-field";

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

  return (
    <div className="forum-shell relative">
      <main ref={contentRef} className="forum-content min-w-0">
        {children}
      </main>

      <footer className="forum-main-footer">
        Powered by <strong>IxForum</strong> v{IXFORUM_VERSION}
      </footer>

      <ForumSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
