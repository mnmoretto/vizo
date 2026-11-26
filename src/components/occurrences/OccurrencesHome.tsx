"use client";

import React, { useState } from "react";
import {
  Building2,
  ClipboardCheck,
  Info,
  Plus,
  Search,
} from "lucide-react";
import { getFirstName } from "@/lib/validators";
import type { OccurrenceStatus, Profile } from "@/types/database";

interface OccurrencesHomeProps {
  profile: Profile;
}

type FilterOption = "todas" | OccurrenceStatus;

const FILTERS: { id: FilterOption; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "aberta", label: "Abertas" },
  { id: "em_andamento", label: "Em andamento" },
  { id: "concluida", label: "Concluídas" },
];

export function OccurrencesHome({ profile }: OccurrencesHomeProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("todas");
  const [showStageNotice, setShowStageNotice] = useState(false);

  const firstName = getFirstName(profile.full_name);
  const unitDisplay = [profile.block, profile.unit].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6 animate-vizo-fade">
      {/* Cabeçalho da tela inicial */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Building2 className="h-3.5 w-3.5 text-teal-700" />
            <span>{unitDisplay || "Unidade vinculada"}</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Olá, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {profile.role === "sindico"
              ? "Acompanhe as ocorrências e vistorias internas do condomínio."
              : "Acompanhe e registre ocorrências da sua unidade ou áreas comuns."}
          </p>
        </div>

        <button
          id="btn-new-occurrence"
          type="button"
          onClick={() => setShowStageNotice(true)}
          className="vizo-btn-primary w-full sm:w-auto shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Nova ocorrência</span>
        </button>
      </section>

      {/* Aviso amigável sobre a próxima etapa */}
      {showStageNotice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-900"
        >
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-teal-700 mt-0.5" />
            <p>
              O formulário de registro de ocorrências com envio de fotos e
              vistorias será adicionado na{" "}
              <strong className="font-semibold">próxima etapa</strong> do Vizo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowStageNotice(false)}
            className="text-xs font-semibold text-teal-800 hover:underline shrink-0 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Filtros preparados para listagem */}
      <section aria-label="Filtros de ocorrências" className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const isActive = selectedFilter === filter.id;
            return (
              <button
                key={filter.id}
                id={`filter-${filter.id}`}
                type="button"
                onClick={() => setSelectedFilter(filter.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200/90 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Estado vazio preparado para listar ocorrências */}
        <div className="vizo-card rounded-2xl px-6 py-12 sm:py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            {selectedFilter === "todas" ? (
              <ClipboardCheck className="h-7 w-7" strokeWidth={1.8} />
            ) : (
              <Search className="h-6 w-6" strokeWidth={1.8} />
            )}
          </div>

          <h2 className="mt-5 text-lg font-semibold text-slate-900">
            {selectedFilter === "todas"
              ? "Nenhuma ocorrência registrada ainda"
              : "Nenhuma ocorrência neste filtro"}
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            {selectedFilter === "todas"
              ? "Quando você registrar uma ocorrência ou vistoria interna, ela aparecerá aqui com status atualizado e histórico completo."
              : "Você ainda não possui registros classificados nesta categoria."}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {selectedFilter !== "todas" ? (
              <button
                type="button"
                onClick={() => setSelectedFilter("todas")}
                className="vizo-btn-secondary w-full sm:w-auto text-sm"
              >
                Ver todas as ocorrências
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowStageNotice(true)}
                className="vizo-btn-secondary w-full sm:w-auto text-sm"
              >
                <Plus className="h-4 w-4 text-teal-700" />
                <span>Registrar primeira ocorrência</span>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
