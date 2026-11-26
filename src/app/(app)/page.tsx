import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OccurrencesHome } from "@/components/occurrences/OccurrencesHome";
import { SindicoDashboard } from "@/components/occurrences/SindicoDashboard";
import { getCurrentSessionProfile } from "@/lib/auth";
import {
  listAllCondoOccurrences,
  listResidentOccurrences,
} from "@/lib/occurrences-server";
import {
  getActiveCondoCookie,
  listSindicoCondominiums,
} from "@/lib/condominiums-server";

export const metadata: Metadata = {
  title: "Ocorrências",
  description:
    "Acompanhe suas ocorrências e vistorias internas registradas no condomínio.",
};

async function HomeContent() {
  const session = await getCurrentSessionProfile();

  if (!session.isAuthenticated || !session.profile || !session.userId) {
    redirect("/login");
  }

  if (session.profile.role === "sindico") {
    const [{ condominiums, schemaMissing: condoSchemaMissing }, savedCondoId] =
      await Promise.all([
        listSindicoCondominiums(session.userId),
        getActiveCondoCookie(),
      ]);

    const activeCondoId =
      savedCondoId === "all" && condominiums.length > 1
        ? "all"
        : (condominiums.find((c) => c.id === savedCondoId)?.id ??
          condominiums[0]?.id ??
          "all");

    const { items, schemaMissing: occSchemaMissing } =
      await listAllCondoOccurrences(
        condominiums.length === 0 ? "all" : activeCondoId,
      );

    return (
      <SindicoDashboard
        profile={session.profile}
        occurrences={items}
        condominiums={condominiums}
        activeCondoId={activeCondoId}
        schemaMissing={condoSchemaMissing || occSchemaMissing}
      />
    );
  }

  const { items, schemaMissing } = await listResidentOccurrences(
    session.userId,
  );

  return (
    <OccurrencesHome
      profile={session.profile}
      occurrences={items}
      schemaMissing={schemaMissing}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-52 rounded-lg bg-slate-200/70" />
          <div className="h-20 rounded-2xl bg-white border border-slate-200/70" />
          <div className="h-32 rounded-2xl bg-white border border-slate-200/70" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
