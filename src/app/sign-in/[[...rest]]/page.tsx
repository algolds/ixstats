import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { facetClerkAppearance } from "~/lib/clerk/theme";

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));

export default function Page() {
  if (!isClerkConfigured) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <div className="border-border bg-card w-full max-w-md rounded-2xl border p-6 text-center shadow-2xl backdrop-blur-xl">
          <h1 className="text-foreground text-xl font-bold tracking-tight">
            Authentication Not Configured
          </h1>
          <p className="text-muted-foreground mt-3 text-xs">
            Clerk publishable keys are not configured for this environment. Add your Clerk keys to
            the environment variables to enable sign-in functionality.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <SignIn
          fallbackRedirectUrl={withBasePath("/dashboard")}
          appearance={facetClerkAppearance}
        />
        <p className="text-muted-foreground text-center text-xs">
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms of Service
          </Link>
          <span className="text-border mx-2">•</span>
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
