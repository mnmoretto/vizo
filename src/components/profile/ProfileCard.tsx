"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  DoorOpen,
  IdCard,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearDemoProfileCookieClient } from "@/lib/demo-session";
import {
  formatCPF,
  formatPhone,
  isValidFullName,
  isValidPhone,
  onlyDigits,
} from "@/lib/validators";
import type { Profile } from "@/types/database";

interface ProfileCardProps {
  profile: Profile;
  condominiumName?: string | null;
  isDemo: boolean;
}

export function ProfileCard({
  profile,
  condominiumName = null,
  isDemo,
}: ProfileCardProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(
    profile.phone ? formatPhone(profile.phone) : "",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (!isValidFullName(fullName)) {
      setSaveError("Informe seu nome e sobrenome completos.");
      return;
    }

    if (!isValidPhone(phone)) {
      setSaveError("Informe um telefone/WhatsApp válido com DDD.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim().replace(/\s+/g, " "),
          phone: onlyDigits(phone),
        })
        .eq("id", profile.id);

      if (error) {
        setSaveError(error.message || "Não foi possível salvar os dados.");
        return;
      }

      setEditing(false);
      setSaveSuccess(true);
      router.refresh();
    } catch {
      setSaveError("Erro inesperado ao atualizar seu perfil.");
    } finally {
      setSaving(false);
    }
  }

  const rows = [
    ...(condominiumName
      ? [
          {
            label: "Condomínio",
            value: condominiumName,
            icon: Building2,
            mono: false,
          },
        ]
      : []),
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
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Meu perfil
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Dados cadastrais vinculados à sua unidade no condomínio.
          </p>
        </div>

        {!editing && !isDemo && (
          <button
            id="btn-edit-profile"
            type="button"
            onClick={() => {
              setFullName(profile.full_name ?? "");
              setPhone(profile.phone ? formatPhone(profile.phone) : "");
              setSaveError(null);
              setSaveSuccess(false);
              setEditing(true);
            }}
            className="vizo-btn-secondary py-2 px-3.5 text-xs sm:text-sm"
          >
            <Pencil className="h-3.5 w-3.5 text-teal-700" />
            <span>Editar dados</span>
          </button>
        )}
      </section>

      {saveSuccess && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Seus dados foram atualizados com sucesso!</span>
        </div>
      )}

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

        {editing ? (
          <form onSubmit={handleSaveProfile} className="p-5 space-y-4" noValidate>
            {saveError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="profile-edit-name"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Nome completo
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="profile-edit-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="vizo-input pl-11"
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-edit-phone"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Telefone / WhatsApp
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="profile-edit-phone"
                  type="tel"
                  inputMode="tel"
                  maxLength={15}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="vizo-input pl-11 font-mono text-[14px]"
                  disabled={saving}
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Para alterar Bloco, Apartamento ou vínculo de condomínio, solicite
              ao síndico.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="vizo-btn-secondary w-full sm:w-auto text-sm"
              >
                <X className="h-4 w-4" />
                <span>Cancelar</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="vizo-btn-primary w-full sm:w-auto text-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Salvar dados</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
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
        )}

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
