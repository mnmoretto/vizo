"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  DoorOpen,
  IdCard,
  Loader2,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearDemoProfileCookieClient } from "@/lib/demo-session";
import { formatCPF, formatPhone } from "@/lib/validators";
import type { Profile } from "@/types/database";

interface ProfileCardProps {
  profile: Profile;
  isDemo: boolean;
}

export function ProfileCard({ profile, isDemo }: ProfileCardProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      if (isDemo) {
        clearDemoProfileCookieClient();
      } else {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const rows = [
    {
      label: "Nome completo",
      value: profile.full_name ?? "—",
      icon: User,
      mono: false,
    },
    {
      label: "E-mail",
      value: profile.email ?? "—",
      icon: Mail,
      mono: false,
    },
    {
      label: "CPF",
      value: profile.cpf ? formatCPF(profile.cpf) : "—",
      icon: IdCard,
      mono: true,
    },
    {
      label: "Telefone / WhatsApp",
      value: profile.phone ? formatPhone(profile.phone) : "—",
      icon: Phone,
      mono: true,
    },
    {
      label: "Bloco / Torre",
      value: profile.block ?? "—",
      icon: Building2,
      mono: false,
    },
    {
      label: "Apartamento / Casa",
      value: profile.unit ?? "—",
      icon: DoorOpen,
      mono: false,
    },
  ];

  return (
    <div className="space-y-6 animate-vizo-fade">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Meu perfil
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Dados cadastrais vinculados à sua unidade no condomínio.
        </p>
      </section>

      <section className="vizo-card rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-700 text-white font-semibold text-base">
              {(profile.full_name ?? "M").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {profile.full_name ?? "Morador"}
              </p>
              <p className="text-xs text-slate-500">
                {profile.role === "sindico"
                  ? "Perfil de administração (Síndico)"
                  : "Perfil padrão (Morador)"}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200/80 px-3 py-1 text-xs font-semibold text-teal-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cadastro verificado
          </span>
        </div>

        <dl className="divide-y divide-slate-100">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <dt className="flex items-center gap-2.5 text-sm text-slate-500">
                  <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{row.label}</span>
                </dt>
                <dd
                  className={`text-sm font-medium text-slate-900 text-right ${
                    row.mono ? "font-mono" : ""
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/40 flex justify-end">
          <button
            id="btn-profile-signout"
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="vizo-btn-secondary w-full sm:w-auto text-sm text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span>Sair da conta</span>
          </button>
        </div>
      </section>
    </div>
  );
}
