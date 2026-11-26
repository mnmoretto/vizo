import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewOccurrenceForm } from "@/components/occurrences/NewOccurrenceForm";
import { getCurrentSessionProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Registrar Ocorrido",
  description:
    "Registre uma nova ocorrência ou vistoria interna com fotos, descrição detalhada e protocolo automático.",
};

async function NewOccurrenceContent() {
  const session = await getCurrentSessionProfile();

  if (!session.isAuthenticated || !session.profile || !session.userId) {
    redirect("/login");
  }

  const unitLabel = [session.profile.block, session.profile.unit]
    .filter(Boolean)
    .join(" · ");

  return <NewOccurrenceForm userId={session.userId} unitLabel={unitLabel} />;
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
