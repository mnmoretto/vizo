"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  FileBadge2,
  Loader2,
  Mail,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setActiveCondoCookieClient } from "@/lib/condo-cookies";
import {
  formatCNPJ,
  onlyDigits,
  validateCondominiumFields,
  type CondominiumFieldErrors,
} from "@/lib/validators";
import type { Condominium } from "@/types/database";

interface CreateCondominiumModalProps {
  open: boolean;
  onClose: () => void;
  sindicoId: string;
  defaultEmail?: string | null;
  onCreated?: (condo: Condominium) => void;
}

export function CreateCondominiumModal({
  open,
  onClose,
  sindicoId,
  defaultEmail,
  onCreated,
}: CreateCondominiumModalProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultEmail ?? "");

  const [fieldErrors, setFieldErrors] = useState<CondominiumFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  function clearError(field: keyof CondominiumFieldErrors) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validateCondominiumFields({
      name,
      cnpj,
      address,
      contactEmail,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("condominiums")
        .insert({
          sindico_id: sindicoId,
          name: name.trim(),
          cnpj: onlyDigits(cnpj),
          address: address.trim(),
          contact_email: contactEmail.trim().toLowerCase(),
        })
        .select("*")
        .single<Condominium>();

      if (error || !data) {
        if (error?.code === "23505" || error?.message.toLowerCase().includes("cnpj")) {
          setFieldErrors((prev) => ({
            ...prev,
            cnpj: "Este CNPJ já está cadastrado no Vizo.",
          }));
          return;
        }
        if (error?.code === "42P01" || error?.code === "PGRST205") {
          setSubmitError(
            "Execute o script supabase/stage4_condominiums.sql no SQL Editor do Supabase antes de criar condomínios.",
          );
          return;
        }
        setSubmitError(
          error?.message || "Não foi possível criar o condomínio agora.",
        );
        return;
      }

      setActiveCondoCookieClient(data.id);
      setName("");
      setCnpj("");
      setAddress("");
      setFieldErrors({});
      onCreated?.(data);
      onClose();
      router.refresh();
    } catch (err) {
      const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
      setSubmitError(`Erro inesperado ao criar condomínio${detail}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-condo-title"
      onClick={() => {
        if (!saving) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-5 animate-vizo-fade"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
              <Building2 className="h-3.5 w-3.5" />
              Novo condomínio
            </span>
            <h2
              id="create-condo-title"
              className="mt-2 text-lg font-bold text-slate-900"
            >
              Cadastrar condomínio
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Você pode gerenciar múltiplos condomínios com o mesmo login de
              síndico.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!saving) onClose();
            }}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="condo-name"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Nome do condomínio <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="condo-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                placeholder="Ex.: Residencial Parque das Árvores"
                className={`vizo-input pl-11 ${fieldErrors.name ? "vizo-input-error" : ""}`}
                disabled={saving}
              />
            </div>
            {fieldErrors.name && (
              <p className="mt-1 text-xs font-medium text-rose-700">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="condo-cnpj"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              CNPJ <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <FileBadge2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="condo-cnpj"
                type="text"
                inputMode="numeric"
                required
                maxLength={18}
                value={cnpj}
                onChange={(e) => {
                  setCnpj(formatCNPJ(e.target.value));
                  clearError("cnpj");
                }}
                placeholder="00.000.000/0001-00"
                className={`vizo-input pl-11 font-mono text-[14px] ${fieldErrors.cnpj ? "vizo-input-error" : ""}`}
                disabled={saving}
              />
            </div>
            {fieldErrors.cnpj && (
              <p className="mt-1 text-xs font-medium text-rose-700">
                {fieldErrors.cnpj}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="condo-address"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Endereço completo <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="condo-address"
                type="text"
                required
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  clearError("address");
                }}
                placeholder="Rua, número, bairro — Cidade/UF"
                className={`vizo-input pl-11 ${fieldErrors.address ? "vizo-input-error" : ""}`}
                disabled={saving}
              />
            </div>
            {fieldErrors.address && (
              <p className="mt-1 text-xs font-medium text-rose-700">
                {fieldErrors.address}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="condo-email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              E-mail do síndico / condomínio{" "}
              <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="condo-email"
                type="email"
                required
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  clearError("contactEmail");
                }}
                placeholder="sindico@condominio.com.br"
                className={`vizo-input pl-11 ${fieldErrors.contactEmail ? "vizo-input-error" : ""}`}
                disabled={saving}
              />
            </div>
            {fieldErrors.contactEmail && (
              <p className="mt-1 text-xs font-medium text-rose-700">
                {fieldErrors.contactEmail}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="vizo-btn-secondary w-full sm:w-auto text-sm"
            >
              Cancelar
            </button>
            <button
              id="btn-submit-create-condo"
              type="submit"
              disabled={saving}
              className="vizo-btn-primary w-full sm:w-auto text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Criar condomínio</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
