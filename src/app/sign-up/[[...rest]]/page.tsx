import { SignUp } from '@clerk/nextjs';

const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_'),
);

export default function Page() {
  if (!isClerkConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow">
          <h1 className="text-xl font-semibold text-gray-900">Authentication Not Configured</h1>
          <p className="mt-3 text-sm text-gray-600">
            Clerk publishable keys are not configured for this environment. Add your Clerk keys to the
            environment variables to enable sign-up functionality.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <SignUp />
      </div>
    </div>
  );
}
