import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { createUrl } from "~/lib/url-utils";
import { Crown } from "lucide-react";
import Link from "next/link";

export function NoCountryState() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <CardTitle className="text-2xl font-bold">No Country Assigned</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6">
            You don't have a country assigned to your account. You need to own a country to use the data editor.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href={createUrl("/countries")}>
              <Button variant="outline">Browse Countries</Button>
            </Link>
            <Link href={createUrl("/mycountry")}>
              <Button>Go to MyCountry</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
