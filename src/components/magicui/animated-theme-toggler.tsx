"use client";

import { Moon, SunDim } from "lucide-react";
import { useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { cn } from "~/lib/utils";
import { useTheme } from "~/context/theme-context";

type props = {
  className?: string;
};

export const AnimatedThemeToggler = ({ className }: props) => {
  const { effectiveTheme, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const changeTheme = async () => {
    if (!buttonRef.current) return;

    // Check if the browser supports view transitions
    if (!document.startViewTransition) {
      toggleTheme();
      return;
    }

    await document.startViewTransition(() => {
      flushSync(() => {
        toggleTheme();
      });
    }).ready;

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
    const y = top + height / 2;
    const x = left + width / 2;

    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRad = Math.hypot(Math.max(left, right), Math.max(top, bottom));

    document.documentElement.animate(
      {
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRad}px at ${x}px ${y}px)`],
      },
      {
        duration: 700,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  };
  return (
    <button
      ref={buttonRef}
      onClick={changeTheme}
      className={cn("rounded-lg p-2 transition-colors hover:bg-white/10", className)}
    >
      {effectiveTheme === "dark" ? <SunDim className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
};
