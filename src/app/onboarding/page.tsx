import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VizoLogo } from "@/components/brand/VizoLogo";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { getCurrentSessionProfile } from "@/lib/auth";
import {
  getInvitePreview,
  getStoredInviteToken,
} from "@/lib/condominiums-server";

export const metadata: Metadata = {
  title: "Completar cadastro",
  description:
    "Informe seus dados obrigatórios e sua unidade residencial para liberar o acesso ao Vizo.",
};

interface OnboardingPageProps {
  searchParams: Promise<{ convite?: string }>;
}

async function OnboardingContent({ searchParams }: OnboardingPageProps) {
  const [session, params, cookieToken] = await Promise.all([
    getCurrentSessionProfile(),
    searchParams,
    getStoredInviteToken(),
  ]);

  if (!session.isAuthenticated || !session.userId) {
    redirect("/login");
  }

  if (session.profile?.onboarding_completed) {
    redirect("/");
  }

  const inviteToken = params.convite?.trim() || cookieToken || null;
  const invitePreview = inviteToken
    ? await getInvitePreview(inviteToken)
    : null;

  return (
    <OnboardingForm
      isDemo={session.isDemo}
      userId={session.userId}
      email={session.email}
      initialProfile={session.profile}
      invitePreview={invitePreview}
    />
  );
}

function OnboardingSkeleton() {
  return (
    <div className="vizo-card rounded-2xl p-6 sm:p-8 space-y-5 animate-pulse">
      <div className="h-6 w-44 rounded-full bg-slate-100" />
      <div className="h-7 w-64 rounded-lg bg-slate-100" />
      <div className="space-y-3 pt-2">
        <div className="h-11 rounded-xl bg-slate-100" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-11 rounded-xl bg-slate-100" />
          <div className="h-11 rounded-xl bg-slate-100" />
        </div>
        <div className="h-11 rounded-xl bg-slate-200/80" />
      </div>
    </div>
  );
}

export default function OnboardingPage({ searchParams }: OnboardingPageProps) {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <header className="flex justify-center">
          <VizoLogo size="md" showSubtitle />
        </header>

        <main>
          <Suspense fallback={<OnboardingSkeleton />}>
            <OnboardingContent searchParams={searchParams} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
