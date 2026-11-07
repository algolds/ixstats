"use client";

import Link from "next/link";
import { EmptyState } from "~/components/ui/empty-state";
import { Pill } from "./brand";
import { useSignInHref } from "./useSignInHref";

/** For a signed-out visitor on a page that acts for them. */
export function SignInPrompt({ title, message }: { title: string; message: string }) {
  const href = useSignInHref();
  return (
    <EmptyState
      title={title}
      message={message}
      action={
        <Pill asChild>
          <Link href={href}>Sign in</Link>
        </Pill>
      }
    />
  );
}
