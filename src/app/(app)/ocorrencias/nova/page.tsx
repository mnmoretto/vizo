import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewOccurrenceForm } from "@/components/occurrences/NewOccurrenceForm";
import { getCurrentSessionProfile } from "@/lib/auth";
import {
  getActiveCondoCookie,
  listSindicoCondominiums,
} from "@/lib/condominiums-server";

export const metadata: Metadata = {
  title: "Registrar Ocorrido",
  description:
    "Registre uma nova ocorrência ou vistoria interna com fotos, categoria, urgência e protocolo automático.",
};

async function NewOccurrenceContent() {
  const session = await getCurrentSessionProfile();

  if (!session.isAuthenticated || !session.profile || !session.userId) {
    redirect("/login");
  }

  const unitLabel = [session.profile.block, session.profile.unit]
    .filter(Boolean)
    .join(" · ");

  let condominiums = undefined;
  let defaultCondoId: string | null = null;

  if (session.profile.role === "sindico") {
    const [condoList, savedCondoId] = await Promise.all([
      listSindicoCondominiums(session.userId),
      getActiveCondoCookie(),
    ]);
    condominiums = condoList.condominiums;
    defaultCondoId =
      condominiums.find((c) => c.id === savedCondoId)?.id ??
      condominiums[0]?.id ??
      null;
  }

  return (
    <NewOccurrenceForm
      userId={session.userId}
      userRole={session.profile.role}
      unitLabel={unitLabel}
      condominiums={condominiums}
      defaultCondoId={defaultCondoId}
    />
  );
}

export default function NewOccurrencePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-pulse">
          <div className="h-7 w-48 rounded-lg bg-slate-200/70" />
          <div className="h-96 rounded-2xl bg-white border border-slate-200/70" />
        </div>
      }
    >
      <NewOccurrenceContent />
    </Suspense>
  );
}
