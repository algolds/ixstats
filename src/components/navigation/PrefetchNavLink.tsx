"use client";

import React, { useRef, useEffect } from "react";
import Link, { type LinkProps } from "next/link";

interface PrefetchNavLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>,
    LinkProps {
  prefetchFn?: () => void | Promise<any>;
  children: React.ReactNode;
  delayMs?: number;
}

export function PrefetchNavLink({
  prefetchFn,
  children,
  delayMs = 100,
  ...props
}: PrefetchNavLinkProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (prefetchFn) {
      timeoutRef.current = setTimeout(() => {
        void prefetchFn();
      }, delayMs);
    }
    if (props.onMouseEnter) {
      props.onMouseEnter(e);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (props.onMouseLeave) {
      props.onMouseLeave(e);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Link
      {...props}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Link>
  );
}
