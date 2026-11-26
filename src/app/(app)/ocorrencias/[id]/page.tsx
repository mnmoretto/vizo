import React, { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, SearchX } from "lucide-react";
import { OccurrenceDetail } from "@/components/occurrences/OccurrenceDetail";
import { getCurrentSessionProfile } from "@/lib/auth";
import { getOccurrenceDetail } from "@/lib/occurrences-server";

export const metadata: Metadata = {
  title: "Detalhes da Ocorrência",
  description:
    "Visualize o protocolo, fotos com data e hora e o histórico cronológico completo da sua ocorrência.",
};

interface OccurrenceDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criado?: string }>;
}

async function OccurrenceDetailContent({
  params,
  searchParams,
}: OccurrenceDetailPageProps) {
  const session = await getCurrentSessionProfile();

  if (!session.isAuthenticated || !session.profile || !session.userId) {
    redirect("/login");
  }

  const [{ id }, resolvedSearch] = await Promise.all([params, searchParams]);
  const { occurrence } = await getOccurrenceDetail(
    id,
    session.userId,
    session.profile.role,
  );

  if (!occurrence) {
    return (
      <div className="vizo-card rounded-2xl px-6 py-12 text-center space-y-4 animate-vizo-fade">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <SearchX className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900">
            Ocorrência não encontrada
          </h1>
          <p className="text-sm text-slate-500">
            Este protocolo não existe ou não pertence à sua conta.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/" className="vizo-btn-secondary inline-flex text-sm">
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para minhas ocorrências</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <OccurrenceDetail
      occurrence={occurrence}
      currentUserId={session.userId}
      justCreated={resolvedSearch.criado === "1"}
    />
  );
}

export default function OccurrenceDetailPage({
  params,
  searchParams,
}: OccurrenceDetailPageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-40 rounded-lg bg-slate-200/70" />
          <div className="h-72 rounded-2xl bg-white border border-slate-200/70" />
          <div className="h-44 rounded-2xl bg-white border border-slate-200/70" />
        </div>
      }
    >
      <OccurrenceDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
