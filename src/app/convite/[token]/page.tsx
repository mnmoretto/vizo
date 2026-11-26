import React, { Suspense } from "react";
import type { Metadata } from "next";
import { VizoLogo } from "@/components/brand/VizoLogo";
import { InviteLandingCard } from "@/components/auth/InviteLandingCard";
import { getCurrentSessionProfile } from "@/lib/auth";
import { getInvitePreview } from "@/lib/condominiums-server";

export const metadata: Metadata = {
  title: "Convite de Condomínio",
  description:
    "Aceite o convite do síndico para criar seu cadastro de morador no Vizo.",
};

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

async function InviteContent({ params }: InvitePageProps) {
  const { token } = await params;
  const [preview, session] = await Promise.all([
    getInvitePreview(token),
    getCurrentSessionProfile(),
  ]);

  return (
    <InviteLandingCard
      token={token}
      preview={preview}
      isAuthenticated={session.isAuthenticated}
      onboardingCompleted={Boolean(session.profile?.onboarding_completed)}
    />
  );
}

export default function InvitePage({ params }: InvitePageProps) {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="flex justify-center">
          <VizoLogo size="lg" />
        </header>

        <main>
          <Suspense
            fallback={
              <div className="vizo-card rounded-2xl p-6 sm:p-8 space-y-4 animate-pulse">
                <div className="h-6 w-40 mx-auto rounded-full bg-slate-100" />
                <div className="h-24 rounded-xl bg-slate-100" />
                <div className="h-11 rounded-xl bg-slate-200/80" />
              </div>
            }
          >
            <InviteContent params={params} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
