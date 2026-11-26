"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DoorClosed,
  History,
  Loader2,
  Lock,
  MessageSquarePlus,
  Phone,
  Send,
  Shield,
  ShieldCheck,
  User,
  X,
  XCircle,
  ZoomIn,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_PHOTOS_PER_UPLOAD,
  OCCURRENCES_BUCKET,
  STATUS_META,
  buildPhotoStoragePath,
  compressImageIfNeeded,
  formatDateTimeBR,
  formatPhotoStampBR,
} from "@/lib/occurrences";
import { formatPhone, onlyDigits } from "@/lib/validators";
import {
  PhotoPicker,
  type PendingPhoto,
} from "@/components/occurrences/PhotoPicker";
import type {
  OccurrenceDetailData,
  OccurrencePhoto,
  UserRole,
} from "@/types/database";

interface OccurrenceDetailProps {
  occurrence: OccurrenceDetailData;
  currentUserId: string;
  currentUserRole: UserRole;
  justCreated?: boolean;
}

type ClosingStatus = "resolvido" | "cancelado";

const MIN_CLOSING_COMMENT_LENGTH = 10;

export function OccurrenceDetail({
  occurrence,
  currentUserId,
  currentUserRole,
  justCreated = false,
}: OccurrenceDetailProps) {
  const router = useRouter();
  const statusMeta = STATUS_META[occurrence.status];
  const isOpen = occurrence.status === "aberto";
  const isSindico = currentUserRole === "sindico";

  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<OccurrencePhoto | null>(
    null,
  );

  // Estado do formulário de atualização intermediária
  const [comment, setComment] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);

  // Estado do modal de encerramento pelo síndico
  const [closingTarget, setClosingTarget] = useState<ClosingStatus | null>(
    null,
  );
  const [closingComment, setClosingComment] = useState("");
  const [closingError, setClosingError] = useState<string | null>(null);
  const [closingLoading, setClosingLoading] = useState(false);

  const pendingPhotosRef = useRef<PendingPhoto[]>([]);

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(() => {
    return () => {
      for (const p of pendingPhotosRef.current) {
        URL.revokeObjectURL(p.previewUrl);
      }
    };
  }, []);

  // Fecha lightbox ou modal de encerramento com a tecla Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (lightboxPhoto) {
        setLightboxPhoto(null);
      } else if (closingTarget && !closingLoading) {
        setClosingTarget(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxPhoto, closingTarget, closingLoading]);

  async function handleCopyProtocol() {
    try {
      await navigator.clipboard.writeText(occurrence.protocol);
      setCopiedProtocol(true);
      setTimeout(() => setCopiedProtocol(false), 2000);
    } catch {
      // Clipboard indisponível em contextos sem permissão
    }
  }

  function handleAddFiles(fileList: FileList | File[]) {
    setPhotosError(null);
    setUpdateError(null);
    const incoming = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (incoming.length === 0) {
      setPhotosError("Selecione apenas imagens válidas.");
      return;
    }

    const availableSlots = MAX_PHOTOS_PER_UPLOAD - pendingPhotos.length;
    const accepted = incoming.slice(0, availableSlots);
    const nowIso = new Date().toISOString();

    const nextPhotos: PendingPhoto[] = accepted.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      capturedAt: nowIso,
    }));

    setPendingPhotos((prev) => [...prev, ...nextPhotos]);
  }

  function handleRemovePhoto(id: string) {
    setPendingPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleAddUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOpen) return;

    setUpdateError(null);
    setUpdateSuccess(false);

    const trimmedComment = comment.trim();
    if (!trimmedComment && pendingPhotos.length === 0) {
      setUpdateError("Escreva um comentário ou anexe pelo menos uma foto.");
      return;
    }

    setSubmittingUpdate(true);
    setUploadStep("Salvando atualização na linha do tempo...");

    try {
      const supabase = createClient();

      const { data: createdUpdate, error: insertError } = await supabase
        .from("occurrence_updates")
        .insert({
          occurrence_id: occurrence.id,
          user_id: currentUserId,
          comment: trimmedComment || null,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError || !createdUpdate) {
        setUpdateError(
          insertError?.message ||
            "Não foi possível adicionar a atualização. Verifique se a ocorrência ainda está aberta.",
        );
        return;
      }

      if (pendingPhotos.length > 0) {
        const photoRows: {
          occurrence_id: string;
          update_id: string;
          user_id: string;
          storage_path: string;
          captured_at: string;
        }[] = [];

        for (let i = 0; i < pendingPhotos.length; i++) {
          setUploadStep(`Enviando foto ${i + 1} de ${pendingPhotos.length}...`);
          const pending = pendingPhotos[i];
          const readyFile = await compressImageIfNeeded(pending.file);
          const storagePath = buildPhotoStoragePath(
            currentUserId,
            occurrence.id,
            readyFile.name,
            i,
          );

          const { error: uploadError } = await supabase.storage
            .from(OCCURRENCES_BUCKET)
            .upload(storagePath, readyFile, {
              contentType: readyFile.type || "image/jpeg",
              upsert: false,
            });

          if (uploadError) {
            setUpdateError(
              `Erro ao enviar a foto ${i + 1}: ${uploadError.message}`,
            );
            return;
          }

          photoRows.push({
            occurrence_id: occurrence.id,
            update_id: createdUpdate.id,
            user_id: currentUserId,
            storage_path: storagePath,
            captured_at: pending.capturedAt,
          });
        }

        const { error: photoMetaError } = await supabase
          .from("occurrence_photos")
          .insert(photoRows);

        if (photoMetaError) {
          setUpdateError(
            "Comentário salvo, mas houve erro ao vincular as fotos enviadas.",
          );
          return;
        }
      }

      for (const p of pendingPhotos) {
        URL.revokeObjectURL(p.previewUrl);
      }
      setComment("");
      setPendingPhotos([]);
      setUpdateSuccess(true);
      router.refresh();
    } catch (err) {
      console.error("[Vizo] Erro ao adicionar atualização:", err);
      const detail =
        err instanceof Error && err.message ? ` (${err.message})` : "";
      setUpdateError(`Erro inesperado ao salvar atualização${detail}.`);
    } finally {
      setSubmittingUpdate(false);
      setUploadStep(null);
    }
  }

  function openClosingModal(status: ClosingStatus) {
    setClosingTarget(status);
    setClosingComment("");
    setClosingError(null);
  }

  async function handleConfirmClose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!closingTarget || !isSindico || !isOpen) return;

    const trimmed = closingComment.trim();
    if (trimmed.length < MIN_CLOSING_COMMENT_LENGTH) {
      setClosingError(
        `Informe um parecer de encerramento com pelo menos ${MIN_CLOSING_COMMENT_LENGTH} caracteres.`,
      );
      return;
    }

    setClosingError(null);
    setClosingLoading(true);

    try {
      const supabase = createClient();

      // Tenta primeiro a função atômica da Etapa 3 (close_occurrence)
      const { error: rpcError } = await supabase.rpc("close_occurrence", {
        p_occurrence_id: occurrence.id,
        p_new_status: closingTarget,
        p_comment: trimmed,
      });

      if (rpcError) {
        // Fallback gracioso caso o SQL da Etapa 3 ainda não tenha sido rodado
        const isMissingRpc =
          rpcError.code === "42883" ||
          rpcError.code === "PGRST202" ||
          rpcError.message.toLowerCase().includes("close_occurrence");

        if (!isMissingRpc) {
          setClosingError(rpcError.message);
          return;
        }

        const prefix =
          closingTarget === "resolvido"
            ? "[Encerrado como Resolvido] "
            : "[Encerrado como Cancelado] ";

        const { error: fallbackUpdateErr } = await supabase
          .from("occurrence_updates")
          .insert({
            occurrence_id: occurrence.id,
            user_id: currentUserId,
            comment: `${prefix}${trimmed}`,
          });

        if (fallbackUpdateErr) {
          setClosingError(fallbackUpdateErr.message);
          return;
        }

        const { error: fallbackStatusErr } = await supabase
          .from("occurrences")
          .update({ status: closingTarget })
          .eq("id", occurrence.id);

        if (fallbackStatusErr) {
          setClosingError(fallbackStatusErr.message);
          return;
        }
      }

      setClosingTarget(null);
      setClosingComment("");
      router.refresh();
    } catch (err) {
      console.error("[Vizo] Erro ao encerrar ocorrência:", err);
      const detail =
        err instanceof Error && err.message ? ` (${err.message})` : "";
      setClosingError(`Não foi possível encerrar o chamado${detail}.`);
    } finally {
      setClosingLoading(false);
    }
  }

  const residentUnitText = [
    occurrence.resident?.block,
    occurrence.resident?.unit,
  ]
    .filter(Boolean)
    .join(" · ");
  const residentWhatsAppDigits = occurrence.resident?.phone
    ? onlyDigits(occurrence.resident.phone)
    : "";

  return (
    <div className="space-y-6 animate-vizo-fade">
      {/* Barra superior de navegação */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>
            {isSindico ? "Painel do condomínio" : "Minhas ocorrências"}
          </span>
        </Link>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
          {statusMeta.label}
        </span>
      </div>

      {/* Confirmação imediata após criação */}
      {justCreated && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3.5 text-sm text-emerald-950"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-semibold">Ocorrência registrada com sucesso!</p>
            <p className="text-xs text-emerald-900 mt-0.5">
              Protocolo{" "}
              <strong className="font-mono">{occurrence.protocol}</strong>{" "}
              gerado em{" "}
              {formatDateTimeBR(occurrence.created_at, { withSeconds: true })}.
            </p>
          </div>
        </div>
      )}

      {/* Ações de Encerramento exclusivas do Síndico (enquanto aberta) */}
      {isSindico && isOpen && (
        <section
          aria-label="Ações administrativas do síndico"
          className="rounded-2xl border border-amber-200/90 bg-amber-50/60 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <Shield className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">
                Encerramento de chamado
              </p>
              <p className="text-xs text-slate-600">
                Ao finalizar, será obrigatório registrar o parecer oficial do
                síndico no histórico.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              id="btn-close-resolved"
              type="button"
              onClick={() => openClosingModal("resolvido")}
              className="vizo-btn-primary text-sm py-2.5 px-4"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Marcar como Resolvido</span>
            </button>

            <button
              id="btn-close-canceled"
              type="button"
              onClick={() => openClosingModal("cancelado")}
              className="vizo-btn-secondary text-sm py-2.5 px-4 text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancelar chamado</span>
            </button>
          </div>
        </section>
      )}

      {/* Card principal — Dados iniciais do registro */}
      <section className="vizo-card rounded-2xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-tight text-teal-900 bg-teal-50 border border-teal-200/80 px-2.5 py-1 rounded-lg">
                {occurrence.protocol}
              </span>
              <button
                type="button"
                onClick={handleCopyProtocol}
                aria-label="Copiar protocolo"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                {copiedProtocol ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>

            <h1 className="mt-3 flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              <DoorClosed className="h-5 w-5 text-teal-700 shrink-0" />
              <span className="break-words">{occurrence.room}</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2 text-xs text-slate-600">
            <CalendarClock className="h-4 w-4 text-teal-700 shrink-0" />
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Registrado em
              </span>
              <span className="font-mono font-medium text-slate-800">
                {formatDateTimeBR(occurrence.created_at, { withSeconds: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Faixa de identificação do morador (visível para o síndico) */}
        {isSindico && occurrence.resident && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{occurrence.resident.full_name || "Morador"}</span>
              </span>
              {residentUnitText && (
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <Building2 className="h-4 w-4 text-teal-700 shrink-0" />
                  <span>{residentUnitText}</span>
                </span>
              )}
            </div>

            {residentWhatsAppDigits && (
              <a
                href={`https://wa.me/55${residentWhatsAppDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-mono">
                  {formatPhone(residentWhatsAppDigits)}
                </span>
              </a>
            )}
          </div>
        )}

        {/* Descrição completa */}
        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Relato inicial
          </h2>
          <p className="whitespace-pre-wrap break-words text-sm sm:text-[15px] leading-relaxed text-slate-700">
            {occurrence.description}
          </p>
        </div>

        {/* Galeria de fotos iniciais com carimbo visível */}
        {occurrence.initialPhotos.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Fotos iniciais ({occurrence.initialPhotos.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {occurrence.initialPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setLightboxPhoto(photo)}
                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 cursor-pointer"
                >
                  <div className="aspect-square w-full overflow-hidden">
                    {photo.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.signedUrl}
                        alt={`Foto registrada em ${formatPhotoStampBR(photo.captured_at)}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        Imagem indisponível
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 bg-slate-900/85 px-2.5 py-1.5 text-[11px] font-mono text-white">
                    <span className="inline-flex items-center gap-1 truncate">
                      <Clock className="h-3 w-3 shrink-0 text-teal-300" />
                      {formatPhotoStampBR(photo.captured_at)}
                    </span>
                    <ZoomIn className="h-3 w-3 shrink-0 text-slate-300 group-hover:text-white" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Linha do Tempo (Histórico Cronológico) */}
      <section aria-label="Histórico cronológico" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
            <History className="h-5 w-5 text-teal-700" />
            <span>Linha do tempo</span>
          </h2>
          <span className="text-xs font-medium text-slate-500">
            {occurrence.updates.length + 1} evento
            {occurrence.updates.length > 0 ? "s" : ""}
          </span>
        </div>

        <ol className="relative space-y-4 pl-6 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
          {/* Marco 1: Abertura */}
          <li className="relative">
            <span className="absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 ring-4 ring-background">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>

            <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  Abertura do protocolo {occurrence.protocol}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {formatDateTimeBR(occurrence.created_at, { withSeconds: true })}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Ocorrência criada em <strong>{occurrence.room}</strong> com{" "}
                {occurrence.initialPhotos.length} foto
                {occurrence.initialPhotos.length === 1 ? "" : "s"} anexada
                {occurrence.initialPhotos.length === 1 ? "" : "s"}.
              </p>
            </div>
          </li>

          {/* Atualizações subsequentes em ordem cronológica */}
          {occurrence.updates.map((upd) => {
            const isSindicoAuthor = upd.author_role === "sindico";
            const closingStatus = upd.status_change;
            const isClosingEntry =
              closingStatus === "resolvido" || closingStatus === "cancelado";

            return (
              <li key={upd.id} className="relative">
                <span
                  className={`absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${
                    closingStatus === "resolvido"
                      ? "bg-emerald-600"
                      : closingStatus === "cancelado"
                        ? "bg-slate-500"
                        : isSindicoAuthor
                          ? "bg-amber-600"
                          : "bg-slate-700"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>

                <div
                  className={`rounded-xl p-4 space-y-3 ${
                    isClosingEntry
                      ? closingStatus === "resolvido"
                        ? "border border-emerald-200 bg-emerald-50/50 shadow-xs"
                        : "border border-slate-300 bg-slate-100/70 shadow-xs"
                      : "vizo-card"
                  }`}
                >
                  {isClosingEntry && (
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                        closingStatus === "resolvido"
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>
                        Parecer final · Encerrado como{" "}
                        {STATUS_META[closingStatus].label}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isSindicoAuthor
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isSindicoAuthor ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                        {isSindicoAuthor ? "Síndico" : "Morador"}
                      </span>
                      {upd.author_name && (
                        <span className="text-xs font-medium text-slate-700">
                          {upd.author_name}
                        </span>
                      )}
                    </div>

                    <span className="font-mono text-xs text-slate-500">
                      {formatDateTimeBR(upd.created_at, { withSeconds: true })}
                    </span>
                  </div>

                  {upd.comment && (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                      {upd.comment}
                    </p>
                  )}

                  {upd.photos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      {upd.photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setLightboxPhoto(photo)}
                          className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left cursor-pointer"
                        >
                          <div className="aspect-square w-full overflow-hidden">
                            {photo.signedUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photo.signedUrl}
                                alt={`Foto de atualização em ${formatPhotoStampBR(photo.captured_at)}`}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                Indisponível
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1 bg-slate-900/85 px-2 py-1 text-[10px] font-mono text-white">
                            <span className="truncate">
                              {formatPhotoStampBR(photo.captured_at)}
                            </span>
                            <ZoomIn className="h-3 w-3 shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Bloco de Atualização (liberado apenas se status === 'aberto') */}
      <section aria-label="Adicionar atualização">
        {isOpen ? (
          <form
            onSubmit={handleAddUpdate}
            className="vizo-card rounded-2xl p-5 sm:p-6 space-y-4"
            noValidate
          >
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-teal-700" />
              <h2 className="text-base font-bold text-slate-900">
                {isSindico
                  ? "Adicionar comentário do síndico"
                  : "Adicionar atualização"}
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              {isSindico
                ? "Registre andamentos intermediários, agendamentos de vistoria ou fotos para o morador acompanhar na linha do tempo."
                : "Enquanto a ocorrência estiver Aberta, você pode incluir novos comentários e/ou novas fotos no histórico."}
            </p>

            {updateError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{updateError}</span>
              </div>
            )}

            {updateSuccess && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Atualização adicionada à linha do tempo!</span>
              </div>
            )}

            <div>
              <label htmlFor="timeline-comment" className="sr-only">
                Novo comentário
              </label>
              <textarea
                id="timeline-comment"
                rows={3}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (updateError) setUpdateError(null);
                  if (updateSuccess) setUpdateSuccess(false);
                }}
                disabled={submittingUpdate}
                placeholder={
                  isSindico
                    ? "Ex.: Vistoria agendada com a equipe de manutenção para amanhã às 10h..."
                    : "Escreva uma atualização ou observação complementar (opcional se enviar fotos)..."
                }
                className="vizo-input resize-y min-h-[92px]"
              />
            </div>

            <PhotoPicker
              photos={pendingPhotos}
              onAddFiles={handleAddFiles}
              onRemovePhoto={handleRemovePhoto}
              disabled={submittingUpdate}
              error={photosError}
              compact
            />

            <button
              id="btn-submit-update"
              type="submit"
              disabled={
                submittingUpdate ||
                (comment.trim().length === 0 && pendingPhotos.length === 0)
              }
              className="vizo-btn-primary w-full sm:w-auto"
            >
              {submittingUpdate ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{uploadStep ?? "Salvando..."}</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Publicar atualização</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-100/80 px-5 py-4 text-sm text-slate-600">
            <Lock className="h-5 w-5 shrink-0 text-slate-500 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">
                Ocorrência encerrada ({statusMeta.label})
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Novos comentários e fotos ficam bloqueados quando o status está
                como <strong>Resolvido</strong> ou <strong>Cancelado</strong>.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Modal obrigatório de parecer de encerramento (Síndico) */}
      {closingTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-modal-title"
          onClick={() => {
            if (!closingLoading) setClosingTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-vizo-fade"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    closingTarget === "resolvido"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {closingTarget === "resolvido" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {closingTarget === "resolvido"
                    ? "Encerrar como Resolvido"
                    : "Encerrar como Cancelado"}
                </span>
                <h2
                  id="close-modal-title"
                  className="mt-2 text-lg font-bold text-slate-900"
                >
                  Parecer final do síndico
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Protocolo{" "}
                  <strong className="font-mono text-slate-700">
                    {occurrence.protocol}
                  </strong>{" "}
                  — Este parecer será registrado no histórico com data e hora e
                  bloqueará novas edições.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!closingLoading) setClosingTarget(null);
                }}
                aria-label="Fechar modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {closingError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{closingError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmClose} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="closing-opinion-input"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Comentário de encerramento / parecer{" "}
                  <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="closing-opinion-input"
                  rows={4}
                  required
                  autoFocus
                  value={closingComment}
                  onChange={(e) => {
                    setClosingComment(e.target.value);
                    if (closingError) setClosingError(null);
                  }}
                  disabled={closingLoading}
                  placeholder={
                    closingTarget === "resolvido"
                      ? "Descreva a solução aplicada, reparo realizado ou conclusão da vistoria..."
                      : "Explique o motivo do cancelamento deste chamado..."
                  }
                  className={`vizo-input resize-y min-h-[110px] ${
                    closingError ? "vizo-input-error" : ""
                  }`}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Mínimo de {MIN_CLOSING_COMMENT_LENGTH} caracteres (
                  {closingComment.trim().length}/{MIN_CLOSING_COMMENT_LENGTH}).
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClosingTarget(null)}
                  disabled={closingLoading}
                  className="vizo-btn-secondary w-full sm:w-auto text-sm"
                >
                  Voltar
                </button>

                <button
                  id="btn-confirm-close-occurrence"
                  type="submit"
                  disabled={
                    closingLoading ||
                    closingComment.trim().length < MIN_CLOSING_COMMENT_LENGTH
                  }
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto ${
                    closingTarget === "resolvido"
                      ? "bg-teal-700 hover:bg-teal-800"
                      : "bg-rose-700 hover:bg-rose-800"
                  }`}
                >
                  {closingLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Confirmando...</span>
                    </>
                  ) : (
                    <>
                      {closingTarget === "resolvido" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span>
                        Confirmar{" "}
                        {closingTarget === "resolvido"
                          ? "Resolvido"
                          : "Cancelamento"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lightbox para ampliar fotos com carimbo de data/hora */}
      {lightboxPhoto && lightboxPhoto.signedUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visualização ampliada da foto"
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-xs text-white">
              <span className="inline-flex items-center gap-1.5 font-mono">
                <Clock className="h-3.5 w-3.5 text-teal-300" />
                Registrada em{" "}
                {formatDateTimeBR(lightboxPhoto.captured_at, {
                  withSeconds: true,
                })}
              </span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Fechar visualização"
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex max-h-[80vh] items-center justify-center bg-black p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxPhoto.signedUrl}
                alt="Foto ampliada da ocorrência"
                className="max-h-[76vh] w-auto max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
