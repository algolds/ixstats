"use client";

import Link from "next/link";
import { UserPlus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SignInButton, SignUpButton } from "~/context/auth-context";

const LINK =
  "text-callout text-tint-ink focus-visible:outline-tint rounded-control-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 pointer-coarse:min-h-11";

/** The page's one ask, after the visitor has seen the platform. */
export function JoinPane() {
  return (
    <Card padding="lg">
      <CardHeader className="px-0 pb-3">
        <CardTitle icon={<UserPlus />} role="heading" aria-level={2}>
          Start your own
        </CardTitle>
        <CardDescription>
          Found a nation in one of the realms above, or take over an open one.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-3 px-0">
        <SignUpButton mode="modal">
          <Button size="lg">Create an account</Button>
        </SignUpButton>
        <Link href="/builder" className={LINK}>
          Build a nation
        </Link>
        <SignInButton mode="modal">
          <button type="button" className={LINK}>
            Sign in
          </button>
        </SignInButton>
      </CardContent>
    </Card>
  );
}
