// src/app/wiki/page.tsx
"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { WikiLinkPreview } from "~/components/wiki/WikiLinkPreview";

export default function WikiRedirectPage() {
  useEffect(() => {
    document.title = "Wiki Integration - IxStats";

    // Auto-redirect after 1.5 seconds
    const timer = setTimeout(() => {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "";
      window.location.href = `${basePath}/w/`;
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const basePath =
    typeof window !== "undefined"
      ? window.location.pathname.startsWith("/projects/ixstates")
        ? "/projects/ixstates"
        : ""
      : "";

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="glass-hierarchy-parent max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-blue-600" />
            Wiki OS Integration
          </CardTitle>
          <CardDescription>Redirecting to WikiOS reader...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            The wiki is now integrated directly into IxStats. You will be redirected to the internal
            WikiOS reader in 1.5 seconds.
          </p>

          <div className="flex items-center gap-3">
            <Link href="/w/" className="flex-1">
              <Button className="w-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                Go to WikiOS Now
              </Button>
            </Link>

            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to IxStats
              </Button>
            </Link>
          </div>

          <div className="text-muted-foreground border-t pt-4 text-xs">
            <p className="mb-2 font-medium">Quick Links:</p>
            <ul className="space-y-1">
              <li>
                <WikiLinkPreview title="Main Page">
                  <Link href="/w/Main_Page" className="text-blue-600 hover:underline">
                    Main Page
                  </Link>
                </WikiLinkPreview>
              </li>
              <li>
                <WikiLinkPreview title="Special:RecentChanges">
                  <Link href="/w/special/recent-changes" className="text-blue-600 hover:underline">
                    Recent Changes
                  </Link>
                </WikiLinkPreview>
              </li>
              <li>
                <WikiLinkPreview title="Special:AllPages">
                  <Link href="/w/special/all-pages" className="text-blue-600 hover:underline">
                    All Pages
                  </Link>
                </WikiLinkPreview>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
