import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));

export default function Page() {
  if (!isClerkConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow">
          <h1 className="text-xl font-semibold text-gray-900">Authentication Not Configured</h1>
          <p className="mt-3 text-sm text-gray-600">
            Clerk publishable keys are not configured for this environment. Add your Clerk keys to
            the environment variables to enable sign-in functionality.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <SignIn fallbackRedirectUrl={withBasePath("/dashboard")} />
        <p className="text-center text-xs text-slate-400">
          <Link href="/terms" className="text-slate-400 hover:text-amber-400 transition-colors">
            Terms of Service
          </Link>
          <span className="mx-2 text-slate-600">•</span>
          <Link href="/privacy" className="text-slate-400 hover:text-amber-400 transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
