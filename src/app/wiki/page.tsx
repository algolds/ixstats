// src/app/wiki/page.tsx
"use client";

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function WikiRedirectPage() {
  useEffect(() => {
    document.title = "Wiki Integration - IxStats";

    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => {
      window.location.href = 'https://ixwiki.com/wiki/';
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <Card className="max-w-lg glass-hierarchy-parent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-blue-600" />
            IxWiki Knowledge Base
          </CardTitle>
          <CardDescription>
            Redirecting to the main IxWiki site...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The IxWiki knowledge base is hosted separately from IxStats.
            You will be redirected to <strong>https://ixwiki.com/wiki/</strong> in 3 seconds.
          </p>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => window.location.href = 'https://ixwiki.com/wiki/'}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Go to IxWiki Now
            </Button>

            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to IxStats
              </Button>
            </Link>
          </div>

          <div className="text-xs text-muted-foreground pt-4 border-t">
            <p className="font-medium mb-2">Quick Links:</p>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://ixwiki.com/wiki/Main_Page"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Main Page
                </a>
              </li>
              <li>
                <a
                  href="https://ixwiki.com/wiki/Special:RecentChanges"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Recent Changes
                </a>
              </li>
              <li>
                <a
                  href="https://ixwiki.com/wiki/Special:AllPages"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  All Pages
                </a>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
