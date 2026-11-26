import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CondominiumsManager } from "@/components/condominiums/CondominiumsManager";
import { getCurrentSessionProfile } from "@/lib/auth";
import {
  getActiveCondoCookie,
  listSindicoCondominiums,
} from "@/lib/condominiums-server";

export const metadata: Metadata = {
  title: "Meus Condomínios",
  description:
    "Cadastre e gerencie múltiplos condomínios com seu acesso de síndico no Vizo.",
};

async function CondominiosContent() {
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

  const activeCondoId =
    condominiums.find((c) => c.id === savedCondoId)?.id ??
    condominiums[0]?.id ??
    "";

  return (
    <CondominiumsManager
      sindicoId={session.userId}
      sindicoEmail={session.email}
      condominiums={condominiums}
      activeCondoId={activeCondoId}
      schemaMissing={schemaMissing}
    />
  );
}

export default function CondominiosPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-52 rounded-lg bg-slate-200/70" />
          <div className="h-44 rounded-2xl bg-white border border-slate-200/70" />
        </div>
      }
    >
      <CondominiosContent />
    </Suspense>
  );
}
