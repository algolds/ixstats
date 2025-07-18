import Link from "next/link";
import { api, HydrateClient } from "~/trpc/server";
import { CommandCenter } from "./_components/CommandCenter";
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await currentUser();
  
  // If user is authenticated, determine their interface
  if (user) {
    try {
      // Get user profile to determine interface
      const userProfile = await api.users.getProfile({ userId: user.id });
      
      if (userProfile) {
        // Users with countries go to ECI
        if (userProfile.countryId) {
          redirect('/eci');
        }
        // Default to SDI for now (can add role-based logic later)
        else {
          redirect('/sdi');
        }
      }
      
      // Default fallback to dashboard
      redirect('/dashboard');
    } catch (error) {
      // If profile lookup fails, redirect to dashboard
      redirect('/dashboard');
    }
  }

  // If not authenticated, show the landing page
  return (
    <HydrateClient>
      <CommandCenter />
    </HydrateClient>
  );
}