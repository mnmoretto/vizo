import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VizoLogo } from "@/components/brand/VizoLogo";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getCurrentSessionProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Redefinir senha",
  description: "Defina uma nova senha de acesso para a sua conta no Vizo.",
};

async function ResetPasswordContent() {
  const session = await getCurrentSessionProfile();

  if (!session.isAuthenticated) {
    redirect("/login");
  }

  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="flex justify-center">
          <VizoLogo size="lg" />
        </header>

        <main>
          <Suspense
            fallback={
              <div className="vizo-card rounded-2xl p-6 space-y-4 animate-pulse">
                <div className="h-6 w-40 rounded-lg bg-slate-100" />
                <div className="h-11 rounded-xl bg-slate-100" />
                <div className="h-11 rounded-xl bg-slate-100" />
              </div>
            }
          >
            <ResetPasswordContent />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
