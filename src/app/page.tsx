import Link from "next/link";
import { api, HydrateClient } from "~/trpc/server";
import { CommandCenter } from "./_components/CommandCenter";
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await currentUser();
  
  // If user is authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  // If not authenticated, show the landing page
  return (
    <HydrateClient>
      <CommandCenter />
    </HydrateClient>
  );
}