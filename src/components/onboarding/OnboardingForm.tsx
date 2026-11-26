"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  DoorOpen,
  IdCard,
  Loader2,
  LogOut,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  clearDemoProfileCookieClient,
  setDemoProfileCookieClient,
} from "@/lib/demo-session";
import {
  formatCPF,
  formatPhone,
  onlyDigits,
  validateOnboardingFields,
  type OnboardingFieldErrors,
} from "@/lib/validators";
import type { Profile } from "@/types/database";

interface OnboardingFormProps {
  isDemo: boolean;
  userId: string;
  email: string | null;
  initialProfile: Profile | null;
}

const BLOCK_SUGGESTIONS = ["Bloco A", "Bloco B", "Torre 1", "Torre 2", "Casa"];

export function OnboardingForm({
  isDemo,
  userId,
  email,
  initialProfile,
}: OnboardingFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initialProfile?.full_name ?? "");
  const [cpf, setCpf] = useState(
    initialProfile?.cpf ? formatCPF(initialProfile.cpf) : "",
  );
  const [phone, setPhone] = useState(
    initialProfile?.phone ? formatPhone(initialProfile.phone) : "",
  );
  const [block, setBlock] = useState(initialProfile?.block ?? "");
  const [unit, setUnit] = useState(initialProfile?.unit ?? "");

  const [fieldErrors, setFieldErrors] = useState<OnboardingFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function clearFieldError(field: keyof OnboardingFieldErrors) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validateOnboardingFields({
      fullName,
      cpf,
      phone,
      block,
      unit,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    const cleanedFullName = fullName.trim().replace(/\s+/g, " ");
    const cleanedCpf = onlyDigits(cpf);
    const cleanedPhone = onlyDigits(phone);
    const cleanedBlock = block.trim();
    const cleanedUnit = unit.trim();

    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        setDemoProfileCookieClient({
          id: userId,
          email,
          full_name: cleanedFullName,
          cpf: cleanedCpf,
          phone: cleanedPhone,
          block: cleanedBlock,
          unit: cleanedUnit,
          role: initialProfile?.role ?? "morador",
          onboarding_completed: true,
        });
        router.push("/");
        router.refresh();
        return;
      }

      const supabase = createClient();

      // Upsert garante criação caso o registro ainda não exista via trigger,
      // mantendo o padrão role = 'morador' para novos usuários.
      const { error } = await supabase.from("profiles").upsert(
        {
          id: userId,
          email,
          full_name: cleanedFullName,
          cpf: cleanedCpf,
          phone: cleanedPhone,
          block: cleanedBlock,
          unit: cleanedUnit,
          role: initialProfile?.role ?? "morador",
          onboarding_completed: true,
        },
        { onConflict: "id" },
      );

      if (error) {
        if (error.code === "23505" || error.message.toLowerCase().includes("cpf")) {
          setFieldErrors((prev) => ({
            ...prev,
            cpf: "Este CPF já está cadastrado em outra conta.",
          }));
          return;
        }

        setSubmitError(
          "Não foi possível salvar seus dados agora. Verifique sua conexão e tente novamente.",
        );
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setSubmitError("Erro inesperado ao salvar seu perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <div className="vizo-card rounded-2xl p-6 sm:p-8 animate-vizo-fade">
      {/* Cabeçalho informativo */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cadastro obrigatório · Morador
          </span>
          <h1 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Complete sua identificação
          </h1>
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">
            Precisamos confirmar seus dados e sua unidade antes de liberar o
            acesso às ocorrências do condomínio.
          </p>
        </div>
      </div>

      {email && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          <span className="truncate">
            Conta conectada: <strong className="text-slate-800">{email}</strong>
          </span>
          <button
            id="btn-onboarding-signout"
            type="button"
            onClick={handleSignOut}
            disabled={signingOut || saving}
            className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-rose-700 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair</span>
          </button>
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
        {/* Nome completo */}
        <div>
          <label
            htmlFor="onboarding-full-name"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Nome completo <span className="text-rose-600">*</span>
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="onboarding-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                clearFieldError("fullName");
              }}
              placeholder="Ex.: Mariana Souza Almeida"
              aria-invalid={Boolean(fieldErrors.fullName)}
              className={`vizo-input pl-10 ${fieldErrors.fullName ? "vizo-input-error" : ""}`}
              disabled={saving}
            />
          </div>
          {fieldErrors.fullName && (
            <p className="mt-1.5 text-xs font-medium text-rose-700">
              {fieldErrors.fullName}
            </p>
          )}
        </div>

        {/* CPF + Telefone lado a lado em telas maiores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="onboarding-cpf"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              CPF <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <IdCard className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="onboarding-cpf"
                name="cpf"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={14}
                value={cpf}
                onChange={(e) => {
                  setCpf(formatCPF(e.target.value));
                  clearFieldError("cpf");
                }}
                placeholder="000.000.000-00"
                aria-invalid={Boolean(fieldErrors.cpf)}
                className={`vizo-input pl-10 font-mono text-[14px] ${fieldErrors.cpf ? "vizo-input-error" : ""}`}
                disabled={saving}
              />
            </div>
            {fieldErrors.cpf && (
              <p className="mt-1.5 text-xs font-medium text-rose-700">
                {fieldErrors.cpf}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="onboarding-phone"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Telefone / WhatsApp <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="onboarding-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                maxLength={15}
                value={phone}
                onChange={(e) => {
                  setPhone(formatPhone(e.target.value));
                  clearFieldError("phone");
                }}
                placeholder="(11) 99999-9999"
                aria-invalid={Boolean(fieldErrors.phone)}
                className={`vizo-input pl-10 font-mono text-[14px] ${fieldErrors.phone ? "vizo-input-error" : ""}`}
                disabled={saving}
              />
            </div>
            {fieldErrors.phone && (
              <p className="mt-1.5 text-xs font-medium text-rose-700">
                {fieldErrors.phone}
              </p>
            )}
          </div>
        </div>

        {/* Unidade residencial */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Sua unidade no condomínio
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="onboarding-block"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Bloco / Torre <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="onboarding-block"
                  name="block"
                  type="text"
                  required
                  value={block}
                  onChange={(e) => {
                    setBlock(e.target.value);
                    clearFieldError("block");
                  }}
                  placeholder='Ex.: Bloco A, Torre 1 ou "Casa"'
                  aria-invalid={Boolean(fieldErrors.block)}
                  className={`vizo-input pl-10 ${fieldErrors.block ? "vizo-input-error" : ""}`}
                  disabled={saving}
                />
              </div>
              {/* Atalhos rápidos mobile-first */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BLOCK_SUGGESTIONS.map((suggestion) => {
                  const isActive =
                    block.trim().toLowerCase() === suggestion.toLowerCase();
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setBlock(suggestion);
                        clearFieldError("block");
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                      }`}
                    >
                      {suggestion}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.block && (
                <p className="mt-1.5 text-xs font-medium text-rose-700">
                  {fieldErrors.block}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="onboarding-unit"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Número do Apartamento / Casa{" "}
                <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <DoorOpen className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="onboarding-unit"
                  name="unit"
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => {
                    setUnit(e.target.value);
                    clearFieldError("unit");
                  }}
                  placeholder="Ex.: 304, 12B ou 08"
                  aria-invalid={Boolean(fieldErrors.unit)}
                  className={`vizo-input pl-10 ${fieldErrors.unit ? "vizo-input-error" : ""}`}
                  disabled={saving}
                />
              </div>
              {fieldErrors.unit && (
                <p className="mt-1.5 text-xs font-medium text-rose-700">
                  {fieldErrors.unit}
                </p>
              )}
            </div>
          </div>
        </div>

        <button
          id="btn-save-onboarding"
          type="submit"
          disabled={saving}
          className="vizo-btn-primary w-full mt-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Salvando cadastro...</span>
            </>
          ) : (
            <>
              <span>Salvar e acessar o Vizo</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
