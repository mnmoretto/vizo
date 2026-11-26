import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { OCCURRENCES_BUCKET } from "@/lib/occurrences";
import type {
  Occurrence,
  OccurrenceDetailData,
  OccurrenceListItem,
  OccurrencePhoto,
  OccurrenceUpdate,
  UserRole,
} from "@/types/database";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.toLowerCase().includes("could not find the table"))
  );
}

/**
 * Busca todas as ocorrências criadas pelo morador logado,
 * já trazendo a miniatura (signed URL), contagem de fotos e contagem de atualizações.
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

  if (!occurrences || occurrences.length === 0) {
    return { items: [], schemaMissing: false };
  }

  const occurrenceIds = occurrences.map((item) => item.id);

  const [photosResult, updatesResult] = await Promise.all([
    supabase
      .from("occurrence_photos")
      .select("id, occurrence_id, storage_path, update_id, created_at")
      .in("occurrence_id", occurrenceIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("occurrence_updates")
      .select("id, occurrence_id")
      .in("occurrence_id", occurrenceIds),
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

  // Escolhe a primeira foto de cada ocorrência para miniatura e assina em lote
  const thumbnailPathByOccurrence = new Map<string, string>();
  const pathsToSign: string[] = [];

  for (const occ of occurrences) {
    const photos = photosByOccurrence.get(occ.id) ?? [];
    // Prioriza foto da abertura inicial; se não houver, pega a primeira disponível
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

  const items: OccurrenceListItem[] = occurrences.map((occ) => {
    const thumbPath = thumbnailPathByOccurrence.get(occ.id);
    const photos = photosByOccurrence.get(occ.id) ?? [];

    return {
      ...occ,
      thumbnailUrl: thumbPath ? (signedUrlByPath.get(thumbPath) ?? null) : null,
      photosCount: photos.length,
      updatesCount: updatesCountByOccurrence.get(occ.id) ?? 0,
    };
  });

  return { items, schemaMissing: false };
}

/**
 * Carrega os detalhes completos de uma ocorrência com fotos iniciais
 * e toda a linha do tempo cronológica (comentários + fotos assinadas).
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

  let query = supabase
    .from("occurrences")
    .select("*")
    .eq("id", occurrenceId);

  // Morador só acessa as próprias ocorrências (RLS também garante isso)
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

  const [updatesResult, photosResult] = await Promise.all([
    supabase
      .from("occurrence_updates")
      .select("id, occurrence_id, user_id, comment, created_at")
      .eq("occurrence_id", occurrence.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("occurrence_photos")
      .select(
        "id, occurrence_id, update_id, user_id, storage_path, captured_at, created_at",
      )
      .eq("occurrence_id", occurrence.id)
      .order("created_at", { ascending: true })
      .returns<OccurrencePhoto[]>(),
  ]);

  const rawUpdates = updatesResult.data ?? [];
  const rawPhotos = photosResult.data ?? [];

  // Busca nomes/papéis dos autores das atualizações
  const authorIds = Array.from(
    new Set(rawUpdates.map((u) => u.user_id).filter(Boolean)),
  );
  const authorMap = new Map<string, { full_name: string | null; role: UserRole }>();

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
      initialPhotos,
      updates,
    },
    schemaMissing: false,
  };
}
