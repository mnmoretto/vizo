import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { OCCURRENCES_BUCKET } from "@/lib/occurrences";
import type {
  Occurrence,
  OccurrenceDetailData,
  OccurrenceListItem,
  OccurrencePhoto,
  OccurrenceStatus,
  OccurrenceUpdate,
  ResidentSummary,
  UserRole,
} from "@/types/database";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora

function isMissingRelationError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.toLowerCase().includes("could not find the table"))
  );
}

/**
 * Hidrata uma lista de ocorrências com miniaturas assinadas, contagem de fotos,
 * contagem de atualizações e (opcionalmente) dados dos moradores.
 */
async function hydrateOccurrenceList(
  occurrences: Occurrence[],
  includeResidents: boolean,
): Promise<OccurrenceListItem[]> {
  if (occurrences.length === 0) return [];

  const supabase = await createClient();
  const occurrenceIds = occurrences.map((item) => item.id);
  const residentIds = Array.from(
    new Set(occurrences.map((item) => item.user_id).filter(Boolean)),
  );

  const [photosResult, updatesResult, residentsResult] = await Promise.all([
    supabase
      .from("occurrence_photos")
      .select("id, occurrence_id, storage_path, update_id, created_at")
      .in("occurrence_id", occurrenceIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("occurrence_updates")
      .select("id, occurrence_id")
      .in("occurrence_id", occurrenceIds),
    includeResidents && residentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, block, unit, phone, email")
          .in("id", residentIds)
          .returns<ResidentSummary[]>()
      : Promise.resolve({ data: [] as ResidentSummary[] }),
  ]);

  const photosByOccurrence = new Map<
    string,
    { storage_path: string; update_id: string | null }[]
  >();

  for (const photo of photosResult.data ?? []) {
    const list = photosByOccurrence.get(photo.occurrence_id) ?? [];
    list.push({
      storage_path: photo.storage_path,
      update_id: photo.update_id,
    });
    photosByOccurrence.set(photo.occurrence_id, list);
  }

  const updatesCountByOccurrence = new Map<string, number>();
  for (const upd of updatesResult.data ?? []) {
    updatesCountByOccurrence.set(
      upd.occurrence_id,
      (updatesCountByOccurrence.get(upd.occurrence_id) ?? 0) + 1,
    );
  }

  const residentById = new Map<string, ResidentSummary>();
  for (const resident of residentsResult.data ?? []) {
    residentById.set(resident.id, resident);
  }

  // Escolhe a primeira foto de cada ocorrência para miniatura e assina em lote
  const thumbnailPathByOccurrence = new Map<string, string>();
  const pathsToSign: string[] = [];

  for (const occ of occurrences) {
    const photos = photosByOccurrence.get(occ.id) ?? [];
    const preferred =
      photos.find((p) => p.update_id === null) ?? photos[0] ?? null;

    if (preferred) {
      thumbnailPathByOccurrence.set(occ.id, preferred.storage_path);
      pathsToSign.push(preferred.storage_path);
    }
  }

  const signedUrlByPath = new Map<string, string>();
  if (pathsToSign.length > 0) {
    const { data: signedBatch } = await supabase.storage
      .from(OCCURRENCES_BUCKET)
      .createSignedUrls(pathsToSign, SIGNED_URL_TTL_SECONDS);

    for (const entry of signedBatch ?? []) {
      if (entry.path && entry.signedUrl) {
        signedUrlByPath.set(entry.path, entry.signedUrl);
      }
    }
  }

  return occurrences.map((occ) => {
    const thumbPath = thumbnailPathByOccurrence.get(occ.id);
    const photos = photosByOccurrence.get(occ.id) ?? [];

    return {
      ...occ,
      thumbnailUrl: thumbPath ? (signedUrlByPath.get(thumbPath) ?? null) : null,
      photosCount: photos.length,
      updatesCount: updatesCountByOccurrence.get(occ.id) ?? 0,
      resident: includeResidents
        ? (residentById.get(occ.user_id) ?? null)
        : null,
    };
  });
}

/**
 * Busca apenas as ocorrências criadas pelo morador logado.
 */
export async function listResidentOccurrences(userId: string): Promise<{
  items: OccurrenceListItem[];
  schemaMissing: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { items: [], schemaMissing: false };
  }

  const supabase = await createClient();

  const { data: occurrences, error } = await supabase
    .from("occurrences")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<Occurrence[]>();

  if (error) {
    if (isMissingRelationError(error)) {
      return { items: [], schemaMissing: true };
    }
    return { items: [], schemaMissing: false };
  }

  const items = await hydrateOccurrenceList(occurrences ?? [], false);
  return { items, schemaMissing: false };
}

/**
 * Busca as ocorrências do condomínio ativo (ou de todos os condomínios geridos)
 * para o Painel do Síndico, incluindo dados de identificação do morador.
 */
export async function listAllCondoOccurrences(
  condominiumId?: string | null,
): Promise<{
  items: OccurrenceListItem[];
  schemaMissing: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { items: [], schemaMissing: false };
  }

  const supabase = await createClient();

  let query = supabase
    .from("occurrences")
    .select("*")
    .order("created_at", { ascending: false });

  if (condominiumId && condominiumId !== "all") {
    query = query.eq("condominium_id", condominiumId);
  }

  const { data: occurrences, error } = await query.returns<Occurrence[]>();

  if (error) {
    if (isMissingRelationError(error)) {
      return { items: [], schemaMissing: true };
    }
    return { items: [], schemaMissing: false };
  }

  const items = await hydrateOccurrenceList(occurrences ?? [], true);
  return { items, schemaMissing: false };
}

/**
 * Carrega os detalhes completos de uma ocorrência com dados do morador,
 * fotos iniciais e toda a linha do tempo cronológica.
 */
export async function getOccurrenceDetail(
  occurrenceId: string,
  userId: string,
  userRole: UserRole,
): Promise<{
  occurrence: OccurrenceDetailData | null;
  schemaMissing: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { occurrence: null, schemaMissing: false };
  }

  const supabase = await createClient();

  let query = supabase.from("occurrences").select("*").eq("id", occurrenceId);

  if (userRole !== "sindico") {
    query = query.eq("user_id", userId);
  }

  const { data: occurrence, error } = await query.maybeSingle<Occurrence>();

  if (error) {
    if (isMissingRelationError(error)) {
      return { occurrence: null, schemaMissing: true };
    }
    return { occurrence: null, schemaMissing: false };
  }

  if (!occurrence) {
    return { occurrence: null, schemaMissing: false };
  }

  // Busca atualizações tentando incluir status_change (Etapa 3) com fallback automático
  // caso o SQL da Etapa 3 ainda não tenha sido aplicado no banco.
  let rawUpdates: {
    id: string;
    occurrence_id: string;
    user_id: string;
    comment: string | null;
    status_change?: OccurrenceStatus | null;
    created_at: string;
  }[] = [];

  const updatesWithStatus = await supabase
    .from("occurrence_updates")
    .select("id, occurrence_id, user_id, comment, status_change, created_at")
    .eq("occurrence_id", occurrence.id)
    .order("created_at", { ascending: true });

  if (updatesWithStatus.error) {
    const updatesFallback = await supabase
      .from("occurrence_updates")
      .select("id, occurrence_id, user_id, comment, created_at")
      .eq("occurrence_id", occurrence.id)
      .order("created_at", { ascending: true });
    rawUpdates = updatesFallback.data ?? [];
  } else {
    rawUpdates = updatesWithStatus.data ?? [];
  }

  const [photosResult, residentResult] = await Promise.all([
    supabase
      .from("occurrence_photos")
      .select(
        "id, occurrence_id, update_id, user_id, storage_path, captured_at, created_at",
      )
      .eq("occurrence_id", occurrence.id)
      .order("created_at", { ascending: true })
      .returns<OccurrencePhoto[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, block, unit, phone, email")
      .eq("id", occurrence.user_id)
      .maybeSingle<ResidentSummary>(),
  ]);

  const rawPhotos = photosResult.data ?? [];

  // Busca nomes/papéis dos autores das atualizações
  const authorIds = Array.from(
    new Set(rawUpdates.map((u) => u.user_id).filter(Boolean)),
  );
  const authorMap = new Map<
    string,
    { full_name: string | null; role: UserRole }
  >();

  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", authorIds);

    for (const author of authors ?? []) {
      authorMap.set(author.id, {
        full_name: author.full_name,
        role: author.role as UserRole,
      });
    }
  }

  // Gera URLs assinadas para todas as fotos da ocorrência em lote
  const storagePaths = rawPhotos.map((p) => p.storage_path);
  const signedUrlByPath = new Map<string, string>();

  if (storagePaths.length > 0) {
    const { data: signedBatch } = await supabase.storage
      .from(OCCURRENCES_BUCKET)
      .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS);

    for (const entry of signedBatch ?? []) {
      if (entry.path && entry.signedUrl) {
        signedUrlByPath.set(entry.path, entry.signedUrl);
      }
    }
  }

  const hydratedPhotos: OccurrencePhoto[] = rawPhotos.map((photo) => ({
    ...photo,
    signedUrl: signedUrlByPath.get(photo.storage_path) ?? null,
  }));

  const initialPhotos = hydratedPhotos.filter((p) => p.update_id === null);
  const photosByUpdate = new Map<string, OccurrencePhoto[]>();

  for (const photo of hydratedPhotos) {
    if (photo.update_id) {
      const list = photosByUpdate.get(photo.update_id) ?? [];
      list.push(photo);
      photosByUpdate.set(photo.update_id, list);
    }
  }

  const updates: OccurrenceUpdate[] = rawUpdates.map((upd) => {
    const author = authorMap.get(upd.user_id);
    return {
      ...upd,
      author_name: author?.full_name ?? null,
      author_role: author?.role ?? "morador",
      photos: photosByUpdate.get(upd.id) ?? [],
    };
  });

  return {
    occurrence: {
      ...occurrence,
      resident: residentResult.data ?? null,
      initialPhotos,
      updates,
    },
    schemaMissing: false,
  };
}
