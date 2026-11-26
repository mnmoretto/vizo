"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  DoorOpen,
  MapPin,
} from "lucide-react";
import { setInviteTokenCookieClient } from "@/lib/condo-cookies";
import type { InvitePreview } from "@/types/database";

interface InviteLandingCardProps {
  token: string;
  preview: InvitePreview;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
}

const REASON_MESSAGES: Record<string, string> = {
  not_found:
    "Este link de convite não foi encontrado. Verifique se o endereço foi copiado por completo.",
  revoked:
    "Este convite foi revogado pelo síndico. Solicite um novo link para fazer seu cadastro.",
  expired:
    "Este convite expirou. Peça ao síndico do seu condomínio para gerar um novo link.",
  exhausted:
    "Este link de convite já atingiu o número máximo de cadastros permitidos.",
};

export function InviteLandingCard({
  token,
  preview,
  isAuthenticated,
  onboardingCompleted,
}: InviteLandingCardProps) {
  const router = useRouter();

  function handleContinue() {
    setInviteTokenCookieClient(token);
    if (isAuthenticated && !onboardingCompleted) {
      router.push(`/onboarding?convite=${encodeURIComponent(token)}`);
    } else {
      router.push(`/login?convite=${encodeURIComponent(token)}&modo=cadastro`);
    }
  }

  if (!preview.valid) {
    const message =
      (preview.reason && REASON_MESSAGES[preview.reason]) ||
      REASON_MESSAGES.not_found;

    return (
      <div className="vizo-card rounded-2xl p-6 sm:p-8 text-center space-y-5 animate-vizo-fade">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertCircle className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-slate-900">
            Convite indisponível
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
        </div>
        <Link href="/login" className="vizo-btn-secondary w-full text-sm">
          Ir para tela de login
        </Link>
      </div>
    );
  }

  const unitLabel = [preview.prefilled_block, preview.prefilled_unit]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="vizo-card rounded-2xl p-6 sm:p-8 space-y-6 animate-vizo-fade">
      <div className="space-y-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Convite válido do síndico
        </span>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Você foi convidado para o Vizo
        </h1>
        <p className="text-sm text-slate-500">
          Crie sua conta de morador para registrar ocorrências e acompanhar
          vistorias internas no seu condomínio.
        </p>
      </div>

      {/* Cartão do Condomínio */}
      <div className="rounded-xl border border-teal-200/80 bg-teal-50/50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-teal-950 font-bold text-base">
          <Building2 className="h-5 w-5 text-teal-700 shrink-0" />
          <span>{preview.condominium_name}</span>
        </div>
        {preview.condominium_address && (
          <p className="flex items-start gap-2 text-xs text-teal-900/80">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-teal-700" />
            <span>{preview.condominium_address}</span>
          </p>
        )}
        {unitLabel && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-teal-900 border border-teal-200/80">
            <DoorOpen className="h-3.5 w-3.5 text-teal-700" />
            <span>Unidade vinculada: {unitLabel}</span>
          </p>
        )}
      </div>

      {isAuthenticated && onboardingCompleted ? (
        <div className="space-y-3 text-center">
          <p className="text-xs text-slate-600">
            Você já está conectado com um cadastro concluído no Vizo.
          </p>
          <Link href="/" className="vizo-btn-primary w-full">
            <span>Acessar o aplicativo</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <button
          id="btn-accept-invite"
          type="button"
          onClick={handleContinue}
          className="vizo-btn-primary w-full"
        >
          <span>
            {isAuthenticated
              ? "Concluir meu cadastro de morador"
              : "Aceitar convite e criar minha conta"}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
