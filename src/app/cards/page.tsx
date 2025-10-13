"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import Link from "next/link";

export default function CardsPlaceholderPage() {
  return (
    <div className="container mx-auto px-4 py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Trading Cards (Coming Soon)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This section is under construction. In the meantime, return to your dashboard.
          </p>
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


