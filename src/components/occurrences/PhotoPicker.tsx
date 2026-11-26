"use client";

import React, { useRef } from "react";
import { Camera, Clock, ImagePlus, Trash2 } from "lucide-react";
import { MAX_PHOTOS_PER_UPLOAD, formatPhotoStampBR } from "@/lib/occurrences";

export interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  capturedAt: string;
}

interface PhotoPickerProps {
  photos: PendingPhoto[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemovePhoto: (id: string) => void;
  disabled?: boolean;
  maxPhotos?: number;
  error?: string | null;
  compact?: boolean;
}

export function PhotoPicker({
  photos,
  onAddFiles,
  onRemovePhoto,
  disabled = false,
  maxPhotos = MAX_PHOTOS_PER_UPLOAD,
  error,
  compact = false,
}: PhotoPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const remaining = Math.max(0, maxPhotos - photos.length);
  const isFull = remaining === 0;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files && files.length > 0) {
      onAddFiles(files);
    }
    // Permite selecionar novamente a mesma foto ou tirar outra em seguida
    event.target.value = "";
  }

  return (
    <div className="space-y-3">
      {/* Inputs ocultos: um focado em câmera traseira mobile, outro em galeria múltipla */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isFull}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isFull}
      />

      {/* Botões de ação mobile-first */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled || isFull}
          className={`flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50/70 font-semibold text-teal-900 hover:bg-teal-100/70 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            compact ? "px-3 py-2.5 text-xs sm:text-sm" : "px-4 py-3 text-sm"
          }`}
        >
          <Camera className="h-4 w-4 text-teal-700 shrink-0" />
          <span>Tirar foto</span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled || isFull}
          className={`flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            compact ? "px-3 py-2.5 text-xs sm:text-sm" : "px-4 py-3 text-sm"
          }`}
        >
          <ImagePlus className="h-4 w-4 text-slate-600 shrink-0" />
          <span>Da galeria</span>
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {photos.length === 0
            ? "Aceita múltiplas fotos (câmera ou galeria)."
            : `${photos.length} de ${maxPhotos} foto${photos.length > 1 ? "s" : ""} selecionada${photos.length > 1 ? "s" : ""}`}
        </span>
        {isFull && (
          <span className="font-medium text-amber-700">Limite atingido</span>
        )}
      </div>

      {error && (
        <p className="text-xs font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}

      {/* Grade de pré-visualização com carimbo de data/hora */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            >
              <div className="aspect-square w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt="Pré-visualização da foto anexada"
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Carimbo de data/hora visível na foto */}
              <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-1 text-[11px] font-mono text-white">
                <Clock className="h-3 w-3 shrink-0 text-teal-300" />
                <span className="truncate">
                  {formatPhotoStampBR(photo.capturedAt)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onRemovePhoto(photo.id)}
                disabled={disabled}
                aria-label="Remover foto"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/75 text-white hover:bg-rose-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
