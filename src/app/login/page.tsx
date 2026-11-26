import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VizoLogo } from "@/components/brand/VizoLogo";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentSessionProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Entrar",
  description:
    "Acesse ou crie sua conta no Vizo para registrar ocorrências e vistorias no seu condomínio.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getCurrentSessionProfile();

  if (session.isAuthenticated) {
    if (session.profile?.onboarding_completed) {
      redirect("/");
    }
    redirect("/onboarding");
  }

  const params = await searchParams;
  const initialError =
    params.error === "auth_callback"
      ? "Não foi possível concluir o acesso com Google. Tente novamente."
      : null;

  return <AuthForm isDemo={session.isDemo} initialError={initialError} />;
}

function LoginSkeleton() {
  return (
    <div className="vizo-card rounded-2xl p-6 sm:p-7 space-y-4 animate-pulse">
      <div className="h-10 rounded-xl bg-slate-100" />
      <div className="h-11 rounded-xl bg-slate-100" />
      <div className="h-11 rounded-xl bg-slate-100" />
      <div className="h-11 rounded-xl bg-slate-200/80" />
    </div>
  );
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="flex flex-col items-center text-center">
          <VizoLogo size="lg" />
          <h1 className="mt-5 text-2xl sm:text-[1.75rem] font-bold tracking-tight text-slate-900">
            Gestão de ocorrências do seu condomínio
          </h1>
          <p className="mt-1.5 max-w-sm text-sm text-slate-500 leading-relaxed">
            Registre solicitações e acompanhe vistorias internas de forma
            simples e organizada.
          </p>
        </header>

        <main>
          <Suspense fallback={<LoginSkeleton />}>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
