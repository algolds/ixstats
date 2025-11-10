"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-3", className)}>
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <Link key={action.href} href={action.href}>
            <Card className="glass-hierarchy-child group h-full cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-gold-500/20">
              <div className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="rounded-full bg-gold-500/10 p-4 transition-all duration-300 group-hover:bg-gold-500/20">
                  <Icon className="h-8 w-8 text-gold-400 transition-all duration-300 group-hover:scale-110" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gold-400">
                    {action.label}
                  </h3>
                  {action.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
