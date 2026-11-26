import type { OccurrenceStatus } from "@/types/database";

export const MIN_DESCRIPTION_LENGTH = 100;
export const MAX_PHOTOS_PER_UPLOAD = 8;
export const OCCURRENCES_BUCKET = "occurrences-media";

export const STATUS_META: Record<
  OccurrenceStatus,
  {
    label: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  aberto: {
    label: "Aberto",
    badgeClass: "bg-teal-50 text-teal-800 border border-teal-200/80",
    dotClass: "bg-teal-600",
  },
  resolvido: {
    label: "Resolvido",
    badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
    dotClass: "bg-emerald-600",
  },
  cancelado: {
    label: "Cancelado",
    badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
    dotClass: "bg-slate-400",
  },
};

/**
 * Formata timestamp ISO em formato brasileiro claro (ex: 25/11/2026 às 17:45)
 */
export function formatDateTimeBR(
  isoDate: string,
  options?: { withSeconds?: boolean },
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";

  const datePart = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    ...(options?.withSeconds ? { second: "2-digit" } : {}),
    timeZone: "America/Sao_Paulo",
  }).format(date);

  return `${datePart} às ${timePart}`;
}

/**
 * Formata carimbo compacto para exibição diretamente sobre/abaixo de fotos
 */
export function formatPhotoStampBR(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

/**
 * Gera nome seguro para arquivo no Supabase Storage dentro da pasta do usuário
 */
export function buildPhotoStoragePath(
  userId: string,
  occurrenceId: string,
  fileName: string,
  index: number,
): string {
  const extMatch = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  const safeExt =
    extMatch && ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extMatch[1])
      ? extMatch[1]
      : "jpg";
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${userId}/${occurrenceId}/${Date.now()}-${index}-${randomSuffix}.${safeExt}`;
}

/**
 * Redimensiona/comprime fotos muito grandes tiradas pela câmera do celular
 * para garantir envio rápido mesmo em 4G, mantendo ótima nitidez (máx 1600px).
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  // Mantém arquivos já leves (< 1.2 MB) intactos
  if (file.size <= 1.2 * 1024 * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxDimension = 1600;
      let { width, height } = img;

      if (width <= maxDimension && height <= maxDimension) {
        resolve(file);
        return;
      }

      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
          resolve(
            new File([blob], `${baseName}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          );
        },
        "image/jpeg",
        0.82,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
