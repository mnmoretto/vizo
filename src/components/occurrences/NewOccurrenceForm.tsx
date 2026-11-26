"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  DoorClosed,
  FileText,
  Home,
  Loader2,
  Send,
  Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  MAX_PHOTOS_PER_UPLOAD,
  MIN_DESCRIPTION_LENGTH,
  OCCURRENCES_BUCKET,
  PRIORITY_META,
  buildPhotoStoragePath,
  compressImageIfNeeded,
} from "@/lib/occurrences";
import {
  PhotoPicker,
  type PendingPhoto,
} from "@/components/occurrences/PhotoPicker";
import {
  CATEGORY_OPTIONS,
  COMMON_AREA_OPTIONS,
  ROOM_OPTIONS,
  type CondominiumWithStats,
  type OccurrencePriority,
  type OccurrenceScope,
  type UserRole,
} from "@/types/database";

interface NewOccurrenceFormProps {
  userId: string;
  userRole: UserRole;
  unitLabel: string;
  condominiums?: CondominiumWithStats[];
  defaultCondoId?: string | null;
}

const PRIORITIES: OccurrencePriority[] = ["normal", "alta", "emergencia"];

export function NewOccurrenceForm({
  userId,
  userRole,
  unitLabel,
  condominiums = [],
  defaultCondoId = null,
}: NewOccurrenceFormProps) {
  const router = useRouter();
  const isSindico = userRole === "sindico";

  const [selectedCondoId, setSelectedCondoId] = useState<string>(
    defaultCondoId || condominiums[0]?.id || "",
  );
  const [scope, setScope] = useState<OccurrenceScope>(
    isSindico ? "area_comum" : "unidade",
  );
  const [room, setRoom] = useState<string>("");
  const [otherRoomDetail, setOtherRoomDetail] = useState<string>("");
  const [category, setCategory] = useState<string>("Hidráulica");
  const [priority, setPriority] = useState<OccurrencePriority>("normal");
  const [description, setDescription] = useState<string>("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);

  const [roomError, setRoomError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [statusStep, setStatusStep] = useState<string | null>(null);

  const photosRef = useRef<PendingPhoto[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const p of photosRef.current) {
        URL.revokeObjectURL(p.previewUrl);
      }
    };
  }, []);

  const locationOptions =
    scope === "area_comum" ? COMMON_AREA_OPTIONS : ROOM_OPTIONS;

  const trimmedLength = description.trim().length;
  const remainingChars = Math.max(0, MIN_DESCRIPTION_LENGTH - trimmedLength);
  const isDescriptionValid = trimmedLength >= MIN_DESCRIPTION_LENGTH;
  const progressPercent = Math.min(
    100,
    Math.round((trimmedLength / MIN_DESCRIPTION_LENGTH) * 100),
  );

  function handleScopeChange(nextScope: OccurrenceScope) {
    setScope(nextScope);
    setRoom("");
    setOtherRoomDetail("");
    setRoomError(null);
  }

  function handleAddFiles(fileList: FileList | File[]) {
    setPhotosError(null);
    const incoming = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (incoming.length === 0) {
      setPhotosError("Selecione apenas arquivos de imagem válidos.");
      return;
    }

    const availableSlots = MAX_PHOTOS_PER_UPLOAD - photos.length;
    const accepted = incoming.slice(0, availableSlots);
    const nowIso = new Date().toISOString();

    const nextPhotos: PendingPhoto[] = accepted.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      capturedAt: nowIso,
    }));

    setPhotos((prev) => [...prev, ...nextPhotos]);

    if (incoming.length > availableSlots) {
      setPhotosError(
        `Limite de ${MAX_PHOTOS_PER_UPLOAD} fotos por registro. As demais foram ignoradas.`,
      );
    }
  }

  function handleRemovePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setRoomError(null);
    setDescriptionError(null);
    setPhotosError(null);

    let hasError = false;

    if (!room) {
      setRoomError(
        scope === "area_comum"
          ? "Selecione o local da área comum."
          : "Selecione o cômodo do imóvel.",
      );
      hasError = true;
    }

    if (!isDescriptionValid) {
      setDescriptionError(
        `A descrição precisa ter no mínimo ${MIN_DESCRIPTION_LENGTH} caracteres (faltam ${remainingChars}).`,
      );
      hasError = true;
    }

    if (photos.length === 0) {
      setPhotosError(
        "Anexe ou tire pelo menos 1 foto do ocorrido para registrar.",
      );
      hasError = true;
    }

    if (hasError) return;

    setSubmitting(true);
    setStatusStep("Registrando ocorrência e gerando protocolo...");

    try {
      if (!isSupabaseConfigured()) {
        setSubmitError(
          "Supabase não conectado: o arquivo .env.local não foi carregado. Verifique o arquivo na raiz do projeto e reinicie o servidor.",
        );
        return;
      }

      const supabase = createClient();

      const finalRoom =
        room === "Outro" && otherRoomDetail.trim().length > 0
          ? `Outro — ${otherRoomDetail.trim()}`
          : room;

      const basePayload: Record<string, unknown> = {
        user_id: userId,
        room: finalRoom,
        description: description.trim(),
        status: "aberto",
        scope,
        category,
        priority,
      };

      if (isSindico && selectedCondoId) {
        basePayload.condominium_id = selectedCondoId;
      }

      let created: { id: string; protocol: string; created_at: string } | null =
        null;
      let createError: { code?: string; message?: string } | null = null;

      const primaryInsert = await supabase
        .from("occurrences")
        .insert(basePayload)
        .select("id, protocol, created_at")
        .single<{ id: string; protocol: string; created_at: string }>();

      if (
        primaryInsert.error &&
        (primaryInsert.error.code === "42703" ||
          primaryInsert.error.code === "PGRST204")
      ) {
        // Fallback automático caso o SQL da Etapa 5 ainda não tenha sido aplicado
        const fallbackInsert = await supabase
          .from("occurrences")
          .insert({
            user_id: userId,
            room: finalRoom,
            description: description.trim(),
            status: "aberto",
          })
          .select("id, protocol, created_at")
          .single<{ id: string; protocol: string; created_at: string }>();
        created = fallbackInsert.data;
        createError = fallbackInsert.error;
      } else {
        created = primaryInsert.data;
        createError = primaryInsert.error;
      }

      if (createError || !created) {
        if (
          createError?.code === "42P01" ||
          createError?.code === "PGRST205"
        ) {
          setSubmitError(
            "As tabelas ainda não foram criadas no Supabase. Execute os scripts SQL no SQL Editor.",
          );
        } else {
          setSubmitError(
            createError?.message ||
              "Não foi possível registrar a ocorrência. Tente novamente.",
          );
        }
        return;
      }

      // Upload das fotos para o bucket privado do Supabase Storage
      const photoRows: {
        occurrence_id: string;
        update_id: null;
        user_id: string;
        storage_path: string;
        captured_at: string;
      }[] = [];

      for (let i = 0; i < photos.length; i++) {
        setStatusStep(`Enviando foto ${i + 1} de ${photos.length}...`);
        const pending = photos[i];
        const readyFile = await compressImageIfNeeded(pending.file);
        const storagePath = buildPhotoStoragePath(
          userId,
          created.id,
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
          setSubmitError(
            `Ocorrência ${created.protocol} criada, mas houve erro ao enviar a foto ${i + 1}: ${uploadError.message}`,
          );
          router.push(`/ocorrencias/${created.id}`);
          router.refresh();
          return;
        }

        photoRows.push({
          occurrence_id: created.id,
          update_id: null,
          user_id: userId,
          storage_path: storagePath,
          captured_at: pending.capturedAt,
        });
      }

      if (photoRows.length > 0) {
        setStatusStep("Salvando carimbo de data/hora das fotos...");
        const { error: photoInsertError } = await supabase
          .from("occurrence_photos")
          .insert(photoRows);

        if (photoInsertError) {
          setSubmitError(
            `Ocorrência registrada, mas houve falha ao vincular as fotos: ${photoInsertError.message}`,
          );
          router.push(`/ocorrencias/${created.id}`);
          router.refresh();
          return;
        }
      }

      router.push(`/ocorrencias/${created.id}?criado=1`);
      router.refresh();
    } catch (err) {
      console.error("[Vizo] Erro ao criar ocorrência:", err);
      const detail =
        err instanceof Error && err.message ? ` (${err.message})` : "";
      setSubmitError(
        `Erro inesperado ao enviar o registro${detail}. Tente novamente.`,
      );
    } finally {
      setSubmitting(false);
      setStatusStep(null);
    }
  }

  return (
    <div className="space-y-5 animate-vizo-fade">
      {/* Voltar + Unidade */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </Link>

        {unitLabel && !isSindico && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {unitLabel}
          </span>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {isSindico ? "Registrar Vistoria / Ocorrência" : "Registrar Ocorrido"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
          Descreva o problema com detalhes e anexe fotos. A data, a hora e o
          código de protocolo serão gerados automaticamente.
        </p>
      </div>

      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="vizo-card rounded-2xl p-5 sm:p-7 space-y-6"
        noValidate
      >
        {/* Seletor de condomínio quando Síndico gerencia múltiplos condomínios */}
        {isSindico && condominiums.length > 0 && (
          <div className="space-y-2">
            <label
              htmlFor="occurrence-condo"
              className="flex items-center gap-2 text-sm font-semibold text-slate-800"
            >
              <Building2 className="h-4 w-4 text-teal-700" />
              <span>Condomínio</span>
            </label>
            <select
              id="occurrence-condo"
              value={selectedCondoId}
              onChange={(e) => setSelectedCondoId(e.target.value)}
              disabled={submitting}
              className="vizo-input bg-white"
            >
              {condominiums.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 1. Escopo: Minha Unidade vs Área Comum */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">
            Onde está o ocorrido? <span className="text-rose-600">*</span>
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleScopeChange("unidade")}
              disabled={submitting}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-all cursor-pointer ${
                scope === "unidade"
                  ? "border-teal-600 bg-teal-50 text-teal-900 shadow-xs"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Home className="h-4 w-4 shrink-0" />
              <span>Minha Unidade</span>
            </button>

            <button
              type="button"
              onClick={() => handleScopeChange("area_comum")}
              disabled={submitting}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-all cursor-pointer ${
                scope === "area_comum"
                  ? "border-teal-600 bg-teal-50 text-teal-900 shadow-xs"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span>Área Comum</span>
            </button>
          </div>
        </div>

        {/* 2. Cômodo / Local + Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="occurrence-room"
              className="flex items-center gap-2 text-sm font-semibold text-slate-800"
            >
              <DoorClosed className="h-4 w-4 text-teal-700" />
              <span>
                {scope === "area_comum"
                  ? "Local da área comum"
                  : "Cômodo do imóvel"}{" "}
                <span className="text-rose-600">*</span>
              </span>
            </label>

            <select
              id="occurrence-room"
              name="room"
              required
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                setRoomError(null);
              }}
              disabled={submitting}
              aria-invalid={Boolean(roomError)}
              className={`vizo-input bg-white ${roomError ? "vizo-input-error" : ""}`}
            >
              <option value="">
                {scope === "area_comum"
                  ? "Selecione o local..."
                  : "Selecione o cômodo..."}
              </option>
              {locationOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            {room === "Outro" && (
              <input
                id="occurrence-room-other"
                type="text"
                value={otherRoomDetail}
                onChange={(e) => setOtherRoomDetail(e.target.value)}
                placeholder="Especifique o local (opcional)"
                maxLength={60}
                disabled={submitting}
                className="vizo-input mt-2"
              />
            )}

            {roomError && (
              <p className="text-xs font-medium text-rose-700">{roomError}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="occurrence-category"
              className="flex items-center gap-2 text-sm font-semibold text-slate-800"
            >
              <Tag className="h-4 w-4 text-teal-700" />
              <span>Categoria</span>
            </label>

            <select
              id="occurrence-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={submitting}
              className="vizo-input bg-white"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Nível de Urgência */}
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <AlertTriangle className="h-4 w-4 text-teal-700" />
            <span>Nível de urgência</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map((level) => {
              const meta = PRIORITY_META[level];
              const isSelected = priority === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPriority(level)}
                  disabled={submitting}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? level === "emergencia"
                        ? "border-rose-500 bg-rose-50 text-rose-950"
                        : level === "alta"
                          ? "border-amber-500 bg-amber-50 text-amber-950"
                          : "border-teal-600 bg-teal-50 text-teal-950"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="block text-xs sm:text-sm font-bold">
                    {meta.label}
                  </span>
                  <span className="hidden sm:block text-[11px] opacity-75 mt-0.5">
                    {meta.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Descrição com contador em tempo real (mínimo 100 caracteres) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="occurrence-description"
              className="flex items-center gap-2 text-sm font-semibold text-slate-800"
            >
              <FileText className="h-4 w-4 text-teal-700" />
              <span>
                Descrição do ocorrido <span className="text-rose-600">*</span>
              </span>
            </label>

            <span
              className={`font-mono text-xs font-semibold ${
                isDescriptionValid ? "text-teal-700" : "text-amber-700"
              }`}
            >
              {trimmedLength} / {MIN_DESCRIPTION_LENGTH} mín.
            </span>
          </div>

          <textarea
            id="occurrence-description"
            name="description"
            required
            rows={5}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (descriptionError) setDescriptionError(null);
            }}
            disabled={submitting}
            aria-invalid={Boolean(descriptionError)}
            placeholder="Explique detalhadamente o que aconteceu, onde exatamente está o problema, quando começou e qualquer detalhe importante para a vistoria..."
            className={`vizo-input resize-y min-h-[132px] leading-relaxed ${
              descriptionError ? "vizo-input-error" : ""
            }`}
          />

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-200 rounded-full ${
                isDescriptionValid ? "bg-teal-600" : "bg-amber-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            {isDescriptionValid ? (
              <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mínimo de {MIN_DESCRIPTION_LENGTH} caracteres atingido.
              </span>
            ) : (
              <span className="text-slate-500">
                Faltam{" "}
                <strong className="font-semibold text-amber-800">
                  {remainingChars} caracteres
                </strong>{" "}
                para liberar o envio.
              </span>
            )}
          </div>

          {descriptionError && (
            <p className="text-xs font-medium text-rose-700">
              {descriptionError}
            </p>
          )}
        </div>

        {/* 5. Upload / Captura de Fotos */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-sm font-semibold text-slate-800">
            Fotos do ocorrido <span className="text-rose-600">*</span>
          </p>
          <p className="text-xs text-slate-500">
            Use a câmera do celular para registrar na hora ou anexe fotos da sua
            galeria.
          </p>

          <PhotoPicker
            photos={photos}
            onAddFiles={handleAddFiles}
            onRemovePhoto={handleRemovePhoto}
            disabled={submitting}
            error={photosError}
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200/70 px-3.5 py-3 text-xs text-slate-600">
          <CalendarClock className="h-4 w-4 shrink-0 text-teal-700 mt-0.5" />
          <p>
            Ao enviar, o Vizo registra automaticamente a{" "}
            <strong className="font-semibold text-slate-800">
              data e hora exatas
            </strong>{" "}
            e gera um{" "}
            <strong className="font-semibold text-slate-800">
              código de protocolo único
            </strong>{" "}
            para acompanhamento.
          </p>
        </div>

        <button
          id="btn-submit-occurrence"
          type="submit"
          disabled={submitting || !isDescriptionValid}
          className="vizo-btn-primary w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{statusStep ?? "Enviando ocorrência..."}</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Enviar registro e gerar protocolo</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
