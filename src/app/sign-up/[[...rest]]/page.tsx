import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
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
            the environment variables to enable sign-up functionality.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <SignUp appearance={facetClerkAppearance} />
        <p className="text-muted-foreground text-center text-xs">
          By registering, you confirm you are at least 16 years old and agree to the{" "}
          <Link href="/terms" className="text-foreground underline hover:text-indigo-400">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-foreground underline hover:text-indigo-400">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
