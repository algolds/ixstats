"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, Settings } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { createUrl } from "~/lib/url-utils";
import { ThinkPagesIcon } from "./ThinkPagesIcon";

interface ThinkPagesHeaderProps {
  countryName?: string;
  isAuthenticated?: boolean;
  onOpenSettings?: () => void;
}

export function ThinkPagesHeader({
  countryName,
  isAuthenticated,
  onOpenSettings,
}: ThinkPagesHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/60 px-3 py-2 backdrop-blur-lg dark:bg-white/5">
        {/* Left: breadcrumb + branding */}
        <div className="flex items-center gap-1.5 text-xs">
          <Link
            href={createUrl("/dashboard")}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <ChevronRight className="text-muted-foreground/50 h-3 w-3" />
          <div className="flex items-center gap-1.5">
            <ThinkPagesIcon size={18} />
            <span className="text-foreground font-semibold tracking-tight">
              ThinkPages
            </span>
          </div>
        </div>

        {/* Right: status */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {countryName && (
                <Badge variant="outline" className="h-5 px-1.5 py-0 text-[0.6rem]">
                  {countryName}
                </Badge>
              )}
              {onOpenSettings && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={onOpenSettings}
                >
                  <Settings className="h-3 w-3" />
                </Button>
              )}
            </>
          ) : (
            <Link href={createUrl("/setup")}>
              <Badge variant="secondary" className="h-5 cursor-pointer px-2 py-0 text-[0.6rem]">
                Sign In
              </Badge>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
