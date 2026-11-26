"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
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
  Send,
  Shield,
  User,
  X,
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
import {
  PhotoPicker,
  type PendingPhoto,
} from "@/components/occurrences/PhotoPicker";
import type { OccurrenceDetailData, OccurrencePhoto } from "@/types/database";

interface OccurrenceDetailProps {
  occurrence: OccurrenceDetailData;
  currentUserId: string;
  justCreated?: boolean;
}

export function OccurrenceDetail({
  occurrence,
  currentUserId,
  justCreated = false,
}: OccurrenceDetailProps) {
  const router = useRouter();
  const statusMeta = STATUS_META[occurrence.status];
  const isOpen = occurrence.status === "aberto";

  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<OccurrencePhoto | null>(
    null,
  );

  // Estado do formulário de atualização da timeline
  const [comment, setComment] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);

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

      // Limpa o formulário e recarrega os dados do servidor
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

  return (
    <div className="space-y-6 animate-vizo-fade">
      {/* Barra superior de navegação */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Minhas ocorrências</span>
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
              gerado em {formatDateTimeBR(occurrence.created_at, { withSeconds: true })}.
            </p>
          </div>
        </div>
      )}

      {/* Card principal — Dados iniciais do registro */}
      <section className="vizo-card rounded-2xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-tight text-teal-900 bg-teal-50 border border-teal-200/80 px-2.5 py-1 rounded-lg">
                {occurrence.protocol}
              </span>
              <button
                type="button"
                onClick={handleCopyProtocol}
                aria-label="Copiar protocolo"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
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
              <span>{occurrence.room}</span>
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

        {/* Descrição completa */}
        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Relato inicial
          </h2>
          <p className="whitespace-pre-wrap text-sm sm:text-[15px] leading-relaxed text-slate-700">
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
            return (
              <li key={upd.id} className="relative">
                <span
                  className={`absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${
                    isSindicoAuthor ? "bg-amber-600" : "bg-slate-700"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>

                <div className="vizo-card rounded-xl p-4 space-y-3">
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
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
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
                Adicionar atualização
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Enquanto a ocorrência estiver <strong>Aberta</strong>, você pode
              incluir novos comentários e/ou novas fotos no histórico.
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
              <label
                htmlFor="timeline-comment"
                className="sr-only"
              >
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
                placeholder="Escreva uma atualização ou observação complementar (opcional se enviar fotos)..."
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
                Caso o problema volte a ocorrer, abra um novo registro.
              </p>
            </div>
          </div>
        )}
      </section>

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
