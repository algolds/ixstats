import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { facetClerkAppearance } from "~/lib/clerk/theme";

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));

export default function Page() {
  if (!isClerkConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl backdrop-blur-xl">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Authentication Not Configured</h1>
          <p className="mt-3 text-xs text-muted-foreground">
            Clerk publishable keys are not configured for this environment. Add your Clerk keys to
            the environment variables to enable sign-in functionality.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <SignIn
          fallbackRedirectUrl={withBasePath("/dashboard")}
          appearance={facetClerkAppearance}
        />
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/terms" className="text-muted-foreground transition-colors hover:text-foreground">
            Terms of Service
          </Link>
          <span className="mx-2 text-border">•</span>
          <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
