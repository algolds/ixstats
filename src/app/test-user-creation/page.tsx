"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useState } from "react";
import { createAbsoluteUrl } from "~/lib/url-utils";

export default function TestUserCreation() {
  const setupDatabaseMutation = api.users.setupDatabase.useMutation();
  const createUserMutation = api.users.createUserRecord.useMutation();
  const [step, setStep] = useState<'setup' | 'user' | 'complete'>('setup');

  const handleSetupDatabase = async () => {
    try {
      const result = await setupDatabaseMutation.mutateAsync();
      console.log("Database setup result:", result);
      alert(`Database setup complete! Created ${result.rolesCreated} roles and ${result.permissionsCreated} permissions.`);
      setStep('user');
    } catch (error) {
      console.error("Error setting up database:", error);
      alert("Error setting up database: " + (error as Error).message);
    }
  };

  const handleCreateUser = async () => {
    try {
      const result = await createUserMutation.mutateAsync();
      console.log("User creation result:", result);
      alert(`User ${result.created ? 'created' : 'already exists'}!`);
      setStep('complete');
      // Reload page to refresh role data
      setTimeout(() => window.location.href = createAbsoluteUrl('/'), 2000);
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Error creating user: " + (error as Error).message);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Setup User Role System</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'setup' && (
            <>
              <p className="text-sm text-muted-foreground">
                Step 1: Setup the database with roles and permissions.
              </p>
              <Button
                onClick={handleSetupDatabase}
                disabled={setupDatabaseMutation.isPending}
                className="w-full"
              >
                {setupDatabaseMutation.isPending ? "Setting up..." : "Setup Database"}
              </Button>
            </>
          )}

          {step === 'user' && (
            <>
              <p className="text-sm text-muted-foreground">
                Step 2: Create your user record and assign System Owner role.
              </p>
              <Button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
                className="w-full"
              >
                {createUserMutation.isPending ? "Creating..." : "Create User Record"}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <>
              <p className="text-sm text-green-600">
                ✅ Setup complete! Redirecting to homepage...
              </p>
              <Button
                onClick={() => window.location.href = createAbsoluteUrl('/')}
                className="w-full"
              >
                Go to Homepage
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
