import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentSessionProfile } from "@/lib/auth";

async function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSessionProfile();

  if (!session.isAuthenticated) {
    redirect("/login");
  }

  if (!session.profile || !session.profile.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <AppShell profile={session.profile} isDemo={session.isDemo}>
      {children}
    </AppShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="h-16 border-b border-slate-200/80 bg-white/90" />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 sm:px-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-slate-200/70" />
        <div className="h-56 rounded-2xl bg-white border border-slate-200/70" />
      </div>
    </div>
  );
}

export default function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
