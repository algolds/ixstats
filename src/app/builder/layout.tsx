"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronUp } from "lucide-react";

/**
 * Builder Layout - Headless mode with scroll-up navigation reveal
 * 
 * The builder starts "headless" - content begins at the top of the viewport.
 * The main site navigation is hidden by default and reveals when scrolling up.
 */
export default function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showNav, setShowNav] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      setIsScrolled(currentScrollY > 100);
      
      // Scrolling up - show nav
      if (currentScrollY < lastScrollY.current) {
        setShowNav(true);
      }
      // Scrolling down - hide nav
      else if (currentScrollY > lastScrollY.current) {
        setShowNav(false);
      }
      
      lastScrollY.current = currentScrollY;
    };

    // Throttle scroll handler
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", throttledScroll, { passive: true });
    return () => window.removeEventListener("scroll", throttledScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setShowNav(true);
  }, []);

  return (
    <>
      {/* CSS to control main navigation visibility */}
      <style jsx global>{`
        /* Hide the main navigation by default in builder */
        body:has([data-builder-headless]) .navigation-bar {
          transform: translateY(-100%);
          transition: transform 0.3s ease-in-out;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
        }
        
        /* Show navigation when scrolling up */
        body:has([data-builder-headless][data-show-nav="true"]) .navigation-bar {
          transform: translateY(0);
        }
        
        /* Ensure mobile nav also hides */
        body:has([data-builder-headless]) .navigation-bar + div[class*="mobile"],
        body:has([data-builder-headless]) [data-mobile-nav] {
          transform: translateY(-100%);
          transition: transform 0.3s ease-in-out;
        }
        
        body:has([data-builder-headless][data-show-nav="true"]) .navigation-bar + div[class*="mobile"],
        body:has([data-builder-headless][data-show-nav="true"]) [data-mobile-nav] {
          transform: translateY(0);
        }
        
        /* When nav is visible, add top padding to builder wrapper */
        [data-builder-headless][data-show-nav="true"] {
          padding-top: 4rem;
          transition: padding-top 0.3s ease-in-out;
        }
      `}</style>
      
      <div 
        data-builder-headless
        data-show-nav={showNav}
        className="min-h-screen"
      >
        {children}
      </div>

      {/* Floating scroll-to-top button — appears when scrolled down and nav is hidden */}
      <button
        onClick={scrollToTop}
        className={`fixed right-4 top-4 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-border/50 bg-background/80 backdrop-blur-sm shadow-md transition-all duration-300 hover:border-blue-400/50 hover:bg-blue-500/10 ${
          isScrolled && !showNav ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0 pointer-events-none"
        }`}
        aria-label="Scroll to top to reveal navigation"
      >
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </button>
    </>
  );
}
