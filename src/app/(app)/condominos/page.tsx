import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResidentsDirectory } from "@/components/condominiums/ResidentsDirectory";
import { getCurrentSessionProfile } from "@/lib/auth";
import {
  getActiveCondoCookie,
  listCondominiumInvites,
  listCondominiumResidentsGrouped,
  listSindicoCondominiums,
} from "@/lib/condominiums-server";

export const metadata: Metadata = {
  title: "Condôminos e Convites",
  description:
    "Visualize todos os moradores agrupados por bloco e apartamento e gerencie links de convite do condomínio.",
};

async function CondominosContent() {
  const session = await getCurrentSessionProfile();

  if (!session.isAuthenticated || !session.profile || !session.userId) {
    redirect("/login");
  }

  if (session.profile.role !== "sindico") {
    redirect("/");
  }

  const [{ condominiums, schemaMissing }, savedCondoId] = await Promise.all([
    listSindicoCondominiums(session.userId),
    getActiveCondoCookie(),
  ]);

  const activeCondo =
    condominiums.find((c) => c.id === savedCondoId) ?? condominiums[0] ?? null;

  if (!activeCondo) {
    return (
      <ResidentsDirectory
        sindicoId={session.userId}
        sindicoEmail={session.email}
        condominiums={condominiums}
        activeCondoId=""
        groups={[]}
        totalResidents={0}
        invites={[]}
        schemaMissing={schemaMissing}
      />
    );
  }

  const [residentsData, invitesData] = await Promise.all([
    listCondominiumResidentsGrouped(activeCondo.id),
    listCondominiumInvites(activeCondo.id),
  ]);

  return (
    <ResidentsDirectory
      sindicoId={session.userId}
      sindicoEmail={session.email}
      condominiums={condominiums}
      activeCondoId={activeCondo.id}
      groups={residentsData.groups}
      totalResidents={residentsData.totalResidents}
      invites={invitesData.invites}
      schemaMissing={
        schemaMissing || residentsData.schemaMissing || invitesData.schemaMissing
      }
    />
  );
}

export default function CondominosPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-56 rounded-lg bg-slate-200/70" />
          <div className="h-20 rounded-2xl bg-white border border-slate-200/70" />
          <div className="h-44 rounded-2xl bg-white border border-slate-200/70" />
        </div>
      }
    >
      <CondominosContent />
    </Suspense>
  );
}
