"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Camera,
  ChevronRight,
  ClipboardCheck,
  Clock,
  DoorClosed,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { getFirstName } from "@/lib/validators";
import { STATUS_META, formatDateTimeBR } from "@/lib/occurrences";
import type {
  OccurrenceListItem,
  OccurrenceStatus,
  Profile,
} from "@/types/database";

interface OccurrencesHomeProps {
  profile: Profile;
  occurrences: OccurrenceListItem[];
  schemaMissing?: boolean;
}

type FilterOption = "todos" | OccurrenceStatus;

const FILTERS: { id: FilterOption; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "aberto", label: "Aberto" },
  { id: "resolvido", label: "Resolvido" },
  { id: "cancelado", label: "Cancelado" },
];

export function OccurrencesHome({
  profile,
  occurrences,
  schemaMissing = false,
}: OccurrencesHomeProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("todos");

  const firstName = getFirstName(profile.full_name);
  const unitDisplay = [profile.block, profile.unit].filter(Boolean).join(" · ");

  const counts = useMemo(() => {
    return {
      todos: occurrences.length,
      aberto: occurrences.filter((o) => o.status === "aberto").length,
      resolvido: occurrences.filter((o) => o.status === "resolvido").length,
      cancelado: occurrences.filter((o) => o.status === "cancelado").length,
    };
  }, [occurrences]);

  const filteredOccurrences = useMemo(() => {
    if (selectedFilter === "todos") return occurrences;
    return occurrences.filter((item) => item.status === selectedFilter);
  }, [occurrences, selectedFilter]);

  return (
    <div className="space-y-6 animate-vizo-fade">
      {/* Cabeçalho da tela inicial do morador */}
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
            Acompanhe seus protocolos ou registre um novo ocorrido no seu imóvel.
          </p>
        </div>

        <Link
          id="btn-register-occurrence"
          href="/ocorrencias/nova"
          className="vizo-btn-primary w-full sm:w-auto shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Registrar Ocorrido</span>
        </Link>
      </section>

      {/* Aviso amigável caso o script SQL da Etapa 2 ainda não tenha sido rodado */}
      {schemaMissing && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3.5 text-sm text-amber-950"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              Banco de dados da Etapa 2 pendente no Supabase
            </p>
            <p className="text-xs leading-relaxed text-amber-900">
              Execute o script{" "}
              <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded">
                supabase/stage2_occurrences.sql
              </code>{" "}
              no SQL Editor do Supabase para ativar o registro de ocorrências,
              timeline e upload de fotos.
            </p>
          </div>
        </div>
      )}

      {/* Filtros de status */}
      <section aria-label="Minhas ocorrências" className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const isActive = selectedFilter === filter.id;
            const count = counts[filter.id];
            return (
              <button
                key={filter.id}
                id={`filter-${filter.id}`}
                type="button"
                onClick={() => setSelectedFilter(filter.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200/90 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <span>{filter.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[11px] font-semibold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Lista de ocorrências do morador OU estado vazio */}
        {filteredOccurrences.length === 0 ? (
          <div className="vizo-card rounded-2xl px-6 py-12 sm:py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              {selectedFilter === "todos" ? (
                <ClipboardCheck className="h-7 w-7" strokeWidth={1.8} />
              ) : (
                <Search className="h-6 w-6" strokeWidth={1.8} />
              )}
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              {selectedFilter === "todos"
                ? "Nenhuma ocorrência registrada ainda"
                : `Nenhuma ocorrência com status "${STATUS_META[selectedFilter].label}"`}
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
              {selectedFilter === "todos"
                ? "Registre seu primeiro ocorrido com fotos e descrição detalhada. Cada registro recebe protocolo único e histórico cronológico."
                : "Você ainda não possui ocorrências classificadas neste status."}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              {selectedFilter !== "todos" ? (
                <button
                  type="button"
                  onClick={() => setSelectedFilter("todos")}
                  className="vizo-btn-secondary w-full sm:w-auto text-sm"
                >
                  Ver todas as ocorrências
                </button>
              ) : (
                <Link
                  href="/ocorrencias/nova"
                  className="vizo-btn-primary w-full sm:w-auto text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Registrar Ocorrido</span>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <ul className="space-y-3" role="list">
            {filteredOccurrences.map((item) => {
              const statusMeta = STATUS_META[item.status];
              return (
                <li key={item.id}>
                  <Link
                    href={`/ocorrencias/${item.id}`}
                    className="vizo-card group flex items-stretch gap-3.5 sm:gap-4 rounded-2xl p-3.5 sm:p-4 transition-all hover:border-teal-700/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    {/* Miniatura da foto */}
                    <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200/70">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt={`Foto da ocorrência ${item.protocol}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Camera className="h-6 w-6" />
                        </div>
                      )}

                      {item.photosCount > 1 && (
                        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          <Camera className="h-2.5 w-2.5" />
                          {item.photosCount}
                        </span>
                      )}
                    </div>

                    {/* Dados principais */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                      <div className="space-y-1.5">
                        {/* Protocolo + Status */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold tracking-tight text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            {item.protocol}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                            />
                            {statusMeta.label}
                          </span>
                        </div>

                        {/* Cômodo */}
                        <div className="flex items-center gap-1.5 text-sm sm:text-base font-semibold text-slate-900 group-hover:text-teal-800 transition-colors">
                          <DoorClosed className="h-4 w-4 shrink-0 text-teal-700" />
                          <span className="truncate">{item.room}</span>
                        </div>

                        {/* Prévia curta da descrição */}
                        <p className="line-clamp-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Rodapé: Data/Hora + Atualizações */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 truncate">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>{formatDateTimeBR(item.created_at)}</span>
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.updatesCount > 0 && (
                            <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                              <MessageSquare className="h-3.5 w-3.5" />
                              {item.updatesCount}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-teal-700 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
