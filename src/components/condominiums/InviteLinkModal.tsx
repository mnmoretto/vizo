"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  DoorOpen,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Condominium, CondominiumInvite } from "@/types/database";

interface InviteLinkModalProps {
  open: boolean;
  onClose: () => void;
  sindicoId: string;
  condominium: Condominium | null;
  initialBlock?: string;
  initialUnit?: string;
  onCreated?: (invite: CondominiumInvite) => void;
}

function generateSecureToken(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function InviteLinkModal(props: InviteLinkModalProps) {
  if (!props.open || !props.condominium) return null;

  const modalKey = `${props.condominium.id}-${props.initialBlock ?? ""}-${props.initialUnit ?? ""}`;
  return (
    <InviteLinkModalInner
      key={modalKey}
      {...props}
      condominium={props.condominium}
    />
  );
}

function InviteLinkModalInner({
  onClose,
  sindicoId,
  condominium,
  initialBlock = "",
  initialUnit = "",
  onCreated,
}: Omit<InviteLinkModalProps, "condominium"> & { condominium: Condominium }) {
  const router = useRouter();

  const [prefilledBlock, setPrefilledBlock] = useState(initialBlock);
  const [prefilledUnit, setPrefilledUnit] = useState(initialUnit);
  const [targetEmail, setTargetEmail] = useState("");
  const [maxUses, setMaxUses] = useState<number>(1);
  const [expiryDays, setExpiryDays] = useState<string>("7");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] =
    useState<CondominiumInvite | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !generating) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generating, onClose]);

  const inviteUrl =
    generatedInvite && typeof window !== "undefined"
      ? `${window.location.origin}/convite/${generatedInvite.token}`
      : "";

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!condominium) return;

    setError(null);
    setGenerating(true);

    try {
      const supabase = createClient();
      const token = generateSecureToken(16);

      const daysNumber = Number(expiryDays);
      const expiresAt =
        daysNumber > 0
          ? new Date(Date.now() + daysNumber * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const { data, error: insertError } = await supabase
        .from("condominium_invites")
        .insert({
          condominium_id: condominium.id,
          created_by: sindicoId,
          token,
          prefilled_block: prefilledBlock.trim() || null,
          prefilled_unit: prefilledUnit.trim() || null,
          target_email: targetEmail.trim().toLowerCase() || null,
          max_uses: maxUses,
          expires_at: expiresAt,
        })
        .select("*")
        .single<CondominiumInvite>();

      if (insertError || !data) {
        if (insertError?.code === "42P01" || insertError?.code === "PGRST205") {
          setError(
            "Execute o script supabase/stage4_condominiums.sql no SQL Editor do Supabase para habilitar os convites.",
          );
          return;
        }
        setError(
          insertError?.message || "Não foi possível gerar o link de convite.",
        );
        return;
      }

      setGeneratedInvite(data);
      onCreated?.(data);
      router.refresh();
    } catch (err) {
      const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
      setError(`Erro inesperado ao gerar convite${detail}.`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback caso clipboard esteja bloqueado
    }
  }

  function buildWhatsAppShareUrl(): string {
    const unitInfo = [
      generatedInvite?.prefilled_block,
      generatedInvite?.prefilled_unit,
    ]
      .filter(Boolean)
      .join(" · ");

    const message = [
      `Olá! Você foi convidado(a) para acessar o *Vizo* do condomínio *${condominium?.name}*${unitInfo ? ` (${unitInfo})` : ""}.`,
      "",
      `Use este link para criar seu cadastro:`,
      inviteUrl,
    ].join("\n");

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      onClick={() => {
        if (!generating) onClose();
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
              <Link2 className="h-3.5 w-3.5" />
              Convite · {condominium.name}
            </span>
            <h2
              id="invite-modal-title"
              className="mt-2 text-lg font-bold text-slate-900"
            >
              {generatedInvite
                ? "Link de convite pronto!"
                : "Gerar link de convite"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {generatedInvite
                ? "Envie o link abaixo para o morador criar a conta já vinculada a este condomínio."
                : "Somente moradores com um convite válido conseguem se cadastrar neste condomínio."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!generating) onClose();
            }}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {generatedInvite ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Convite ativo para até{" "}
                <strong>
                  {generatedInvite.max_uses} cadastro
                  {generatedInvite.max_uses > 1 ? "s" : ""}
                </strong>
                .
              </span>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="generated-invite-url"
                className="block text-xs font-semibold text-slate-600"
              >
                Link de convite compartilhável
              </label>
              <input
                id="generated-invite-url"
                type="text"
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="vizo-input font-mono text-xs bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                id="btn-copy-invite-link"
                type="button"
                onClick={handleCopyLink}
                className="vizo-btn-primary text-sm"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Link copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copiar link</span>
                  </>
                )}
              </button>

              <a
                href={buildWhatsAppShareUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="vizo-btn-secondary text-sm border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300"
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                <span>Enviar no WhatsApp</span>
              </a>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setGeneratedInvite(null);
                  setCopied(false);
                }}
                className="text-xs font-semibold text-teal-800 hover:underline cursor-pointer"
              >
                Gerar outro convite
              </button>
              <button
                type="button"
                onClick={onClose}
                className="vizo-btn-secondary py-2 px-4 text-xs"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Unidade opcional pré-definida */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="invite-block"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Bloco / Torre (opcional)
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="invite-block"
                    type="text"
                    value={prefilledBlock}
                    onChange={(e) => setPrefilledBlock(e.target.value)}
                    placeholder="Ex.: Bloco A"
                    className="vizo-input pl-11 py-2.5 text-sm"
                    disabled={generating}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="invite-unit"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Apto / Casa (opcional)
                </label>
                <div className="relative">
                  <DoorOpen className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="invite-unit"
                    type="text"
                    value={prefilledUnit}
                    onChange={(e) => setPrefilledUnit(e.target.value)}
                    placeholder="Ex.: 304"
                    className="vizo-input pl-11 py-2.5 text-sm"
                    disabled={generating}
                  />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 -mt-2">
              Se preencher Bloco e Apto, o morador já entra vinculado direto a
              essa unidade. Se deixar vazio, ele informa no cadastro.
            </p>

            {/* Limite de usos + Validade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="invite-max-uses"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Limite de cadastros
                </label>
                <div className="relative">
                  <Users className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    id="invite-max-uses"
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="vizo-input pl-11 py-2.5 text-sm bg-white"
                    disabled={generating}
                  >
                    <option value={1}>1 morador (uso único)</option>
                    <option value={2}>Até 2 moradores (família)</option>
                    <option value={4}>Até 4 moradores</option>
                    <option value={10}>Até 10 moradores</option>
                    <option value={50}>Até 50 moradores (lote)</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="invite-expiry"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Validade do link
                </label>
                <select
                  id="invite-expiry"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="vizo-input py-2.5 text-sm bg-white"
                  disabled={generating}
                >
                  <option value="7">7 dias</option>
                  <option value="30">30 dias</option>
                  <option value="0">Sem expiração</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="invite-email"
                className="block text-xs font-semibold text-slate-600 mb-1"
              >
                E-mail ou referência do morador (opcional)
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="invite-email"
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="Apenas para controle interno do síndico"
                  className="vizo-input pl-11 py-2.5 text-sm"
                  disabled={generating}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={generating}
                className="vizo-btn-secondary w-full sm:w-auto text-sm"
              >
                Cancelar
              </button>
              <button
                id="btn-generate-invite-confirm"
                type="submit"
                disabled={generating}
                className="vizo-btn-primary w-full sm:w-auto text-sm"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Gerando link...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Gerar link de convite</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
