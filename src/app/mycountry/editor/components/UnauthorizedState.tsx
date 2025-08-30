import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createUrl } from "~/lib/url-utils";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function UnauthorizedState() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6">
            You need to be signed in to access the country data editor.
          </p>
          <Link href={createUrl("/mycountry")}>
            <Button>Go to MyCountry</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
