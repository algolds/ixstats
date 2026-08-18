import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));

export default function Page() {
  if (!isClerkConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow">
          <h1 className="text-xl font-semibold text-gray-900">Authentication Not Configured</h1>
          <p className="mt-3 text-sm text-gray-600">
            Clerk publishable keys are not configured for this environment. Add your Clerk keys to
            the environment variables to enable sign-up functionality.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <SignUp />
        <p className="text-center text-xs text-slate-400">
          By registering, you confirm you are at least 16 years old and agree to the{" "}
          <Link href="/terms" className="text-amber-400 underline hover:text-amber-300">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-amber-400 underline hover:text-amber-300">
            Privacy Policy
          </Link>.
        </p>
      </div>
    </div>
  );
}
