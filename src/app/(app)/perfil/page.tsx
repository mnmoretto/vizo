import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { getCurrentSessionProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Meu Perfil",
  description: "Visualize seus dados de morador e unidade no Vizo.",
};

async function ProfileContent() {
  const session = await getCurrentSessionProfile();

  if (!session.isAuthenticated || !session.profile) {
    redirect("/login");
  }

  return <ProfileCard profile={session.profile} isDemo={session.isDemo} />;
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-36 rounded-lg bg-slate-200/70" />
          <div className="h-72 rounded-2xl bg-white border border-slate-200/70" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
