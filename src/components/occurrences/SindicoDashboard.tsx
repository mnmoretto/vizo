"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Camera,
  ChevronRight,
  ClipboardList,
  Clock,
  DoorClosed,
  FilterX,
  MessageSquare,
  Plus,
  Search,
  Shield,
  Tag,
  User,
  X,
} from "lucide-react";
import {
  PRIORITY_META,
  STATUS_META,
  formatDateTimeBR,
  formatOpenAgeBR,
} from "@/lib/occurrences";
import { CondominiumSwitcher } from "@/components/condominiums/CondominiumSwitcher";
import type {
  CondominiumWithStats,
  OccurrenceListItem,
  OccurrencePriority,
  OccurrenceStatus,
  Profile,
} from "@/types/database";

interface SindicoDashboardProps {
  profile: Profile;
  occurrences: OccurrenceListItem[];
  condominiums: CondominiumWithStats[];
  activeCondoId: string;
  schemaMissing?: boolean;
}

type StatusFilter = "todos" | OccurrenceStatus;
type PriorityFilter = "todas" | OccurrencePriority;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "aberto", label: "Aberto" },
  { id: "resolvido", label: "Resolvido" },
  { id: "cancelado", label: "Cancelado" },
];

export function SindicoDashboard({
  profile,
  occurrences,
  condominiums,
  activeCondoId,
  schemaMissing = false,
}: SindicoDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [blockFilter, setBlockFilter] = useState("todos");
  const [unitQuery, setUnitQuery] = useState("");

  const availableBlocks = useMemo(() => {
    const blocks = new Set<string>();
    for (const item of occurrences) {
      const b = item.resident?.block?.trim();
      if (b) blocks.add(b);
    }
    return Array.from(blocks).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true }),
    );
  }, [occurrences]);

  const statusCounts = useMemo(() => {
    return {
      todos: occurrences.length,
      aberto: occurrences.filter((o) => o.status === "aberto").length,
      resolvido: occurrences.filter((o) => o.status === "resolvido").length,
      cancelado: occurrences.filter((o) => o.status === "cancelado").length,
    };
  }, [occurrences]);

  const filteredOccurrences = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const normalizedUnit = unitQuery.trim().toLowerCase();

    return occurrences.filter((item) => {
      if (statusFilter !== "todos" && item.status !== statusFilter) {
        return false;
      }

      if (
        priorityFilter !== "todas" &&
        (item.priority ?? "normal") !== priorityFilter
      ) {
        return false;
      }

      if (blockFilter !== "todos") {
        const itemBlock = (item.resident?.block ?? "").trim().toLowerCase();
        if (itemBlock !== blockFilter.toLowerCase()) {
          return false;
        }
      }

      if (normalizedUnit) {
        const itemUnit = (item.resident?.unit ?? "").trim().toLowerCase();
        const combinedLocation = `${item.resident?.block ?? ""} ${itemUnit}`
          .trim()
          .toLowerCase();
        if (
          !itemUnit.includes(normalizedUnit) &&
          !combinedLocation.includes(normalizedUnit)
        ) {
          return false;
        }
      }

      if (normalizedQuery) {
        const searchable = [
          item.protocol,
          item.resident?.full_name ?? "",
          item.room,
          item.category ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(normalizedQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [
    occurrences,
    statusFilter,
    priorityFilter,
    blockFilter,
    unitQuery,
    searchQuery,
  ]);

  const hasActiveFilters =
    statusFilter !== "todos" ||
    priorityFilter !== "todas" ||
    blockFilter !== "todos" ||
    unitQuery.trim().length > 0 ||
    searchQuery.trim().length > 0;

  function clearAllFilters() {
    setStatusFilter("todos");
    setPriorityFilter("todas");
    setBlockFilter("todos");
    setUnitQuery("");
    setSearchQuery("");
  }

  return (
    <div className="space-y-6 animate-vizo-fade">
      {/* Cabeçalho do Painel Geral do Condomínio */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            <Shield className="h-3.5 w-3.5" />
            <span>Painel do Síndico</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Painel Geral do Condomínio
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie ocorrências e vistorias
            {profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:items-end">
          <Link
            href="/ocorrencias/nova"
            className="vizo-btn-secondary w-full sm:w-auto py-2 px-3.5 text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4 text-teal-700" />
            <span>Registrar vistoria / ocorrência</span>
          </Link>

          {/* Resumo compacto de status */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => setStatusFilter("aberto")}
              className="rounded-xl border border-teal-200/80 bg-teal-50/70 px-3 py-1.5 text-left transition-colors hover:bg-teal-100/70 cursor-pointer"
            >
              <span className="block text-[11px] font-medium text-teal-800">
                Abertas
              </span>
              <span className="font-mono text-base font-bold text-teal-950">
                {statusCounts.aberto}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("resolvido")}
              className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-1.5 text-left transition-colors hover:bg-emerald-100/70 cursor-pointer"
            >
              <span className="block text-[11px] font-medium text-emerald-800">
                Resolvidas
              </span>
              <span className="font-mono text-base font-bold text-emerald-950">
                {statusCounts.resolvido}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("cancelado")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <span className="block text-[11px] font-medium text-slate-600">
                Canceladas
              </span>
              <span className="font-mono text-base font-bold text-slate-800">
                {statusCounts.cancelado}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Seletor de Condomínio + Botão de Gerar Convite + Novo Condomínio */}
      <CondominiumSwitcher
        sindicoId={profile.id}
        sindicoEmail={profile.email}
        condominiums={condominiums}
        activeCondoId={activeCondoId}
        allowAllOption
      />

      {schemaMissing && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3.5 text-sm text-amber-950"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Execute os scripts SQL pendentes em{" "}
            <code className="font-mono bg-white/80 px-1 py-0.5 rounded">
              supabase/
            </code>{" "}
            no SQL Editor do Supabase.
          </p>
        </div>
      )}

      {/* Barra de Filtros: Busca Ampliada + Bloco/Apto + Urgência + Status */}
      <section
        aria-label="Filtros do painel"
        className="vizo-card rounded-2xl p-4 sm:p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Busca por Protocolo, Morador ou Cômodo */}
          <div className="sm:col-span-5">
            <label
              htmlFor="sindico-search-protocol"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Buscar (Protocolo, morador ou local)
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="sindico-search-protocol"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex.: VIZ-2026, Marina ou Elevador"
                className="vizo-input pl-10 pr-9 py-2.5 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpar busca"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Bloco/Torre */}
          <div className="sm:col-span-3">
            <label
              htmlFor="sindico-filter-block"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Bloco / Torre
            </label>
            <select
              id="sindico-filter-block"
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="vizo-input py-2.5 text-sm bg-white"
            >
              <option value="todos">Todos</option>
              {availableBlocks.map((block) => (
                <option key={block} value={block}>
                  {block}
                </option>
              ))}
            </select>
          </div>

          {/* Apartamento/Casa */}
          <div className="sm:col-span-2">
            <label
              htmlFor="sindico-filter-unit"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Apto / Casa
            </label>
            <input
              id="sindico-filter-unit"
              type="text"
              value={unitQuery}
              onChange={(e) => setUnitQuery(e.target.value)}
              placeholder="Ex.: 304"
              className="vizo-input py-2.5 text-sm"
            />
          </div>

          {/* Urgência */}
          <div className="sm:col-span-2">
            <label
              htmlFor="sindico-filter-priority"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Urgência
            </label>
            <select
              id="sindico-filter-priority"
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as PriorityFilter)
              }
              className="vizo-input py-2.5 text-sm bg-white"
            >
              <option value="todas">Todas</option>
              <option value="emergencia">Emergência</option>
              <option value="alta">Alta</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>

        {/* Filtros de Status + Limpar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  id={`sindico-status-${filter.id}`}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-semibold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    {statusCounts[filter.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950 transition-colors cursor-pointer"
            >
              <FilterX className="h-3.5 w-3.5" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>
      </section>

      {/* Contador de resultados */}
      <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-0.5">
        <span>
          Exibindo{" "}
          <strong className="text-slate-800">
            {filteredOccurrences.length}
          </strong>{" "}
          de {occurrences.length} ocorrência
          {occurrences.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Lista Geral de Ocorrências */}
      {filteredOccurrences.length === 0 ? (
        <div className="vizo-card rounded-2xl px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">
            {occurrences.length === 0
              ? "Nenhuma ocorrência registrada neste condomínio"
              : "Nenhuma ocorrência encontrada com esses filtros"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {occurrences.length === 0
              ? "Assim que moradores registrarem chamados ou você registrar uma vistoria, eles aparecerão aqui."
              : "Tente ajustar a busca, o bloco/apartamento ou os filtros."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="vizo-btn-secondary mt-5 text-sm"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {filteredOccurrences.map((item) => {
            const statusMeta = STATUS_META[item.status];
            const priority = item.priority ?? "normal";
            const priorityMeta = PRIORITY_META[priority];
            const age =
              item.status === "aberto"
                ? formatOpenAgeBR(item.created_at)
                : null;
            const residentName =
              item.resident?.full_name || "Morador não identificado";
            const unitText = [item.resident?.block, item.resident?.unit]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={item.id}>
                <Link
                  href={`/ocorrencias/${item.id}`}
                  className="vizo-card group flex items-stretch gap-3.5 sm:gap-4 rounded-2xl p-3.5 sm:p-4 transition-all hover:border-teal-700/35 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {/* Miniatura */}
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

                  {/* Informações completas para o síndico */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                    <div className="space-y-1.5">
                      {/* Linha 1: Protocolo + Urgência + Status */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-bold tracking-tight text-teal-900 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-md">
                            {item.protocol}
                          </span>
                          {priority !== "normal" && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityMeta.badgeClass}`}
                            >
                              {priorityMeta.label}
                            </span>
                          )}
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                          />
                          {statusMeta.label}
                        </span>
                      </div>

                      {/* Linha 2: Morador + Bloco/Apartamento */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 min-w-0">
                          <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{residentName}</span>
                        </span>

                        {unitText && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            <Building2 className="h-3 w-3 shrink-0 text-teal-700" />
                            <span>{unitText}</span>
                          </span>
                        )}
                      </div>

                      {/* Linha 3: Cômodo + Área Comum + Categoria */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <DoorClosed className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                          <span>{item.room}</span>
                        </span>

                        {item.scope === "area_comum" && (
                          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                            Área Comum
                          </span>
                        )}

                        {item.category && item.category !== "Outro" && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <Tag className="h-3 w-3 text-slate-400" />
                            {item.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rodapé: Data/Hora + Tempo em aberto + Última resposta */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>{formatDateTimeBR(item.created_at)}</span>
                        </span>
                        {age && (
                          <span
                            className={`font-medium ${
                              age.days >= 5
                                ? "text-rose-700 font-semibold"
                                : age.days >= 2
                                  ? "text-amber-700"
                                  : "text-slate-400"
                            }`}
                          >
                            · Aberta {age.label}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === "aberto" && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              item.lastUpdateAuthorRole === "sindico"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-50 text-amber-800 border border-amber-200/80"
                            }`}
                          >
                            {item.lastUpdateAuthorRole === "sindico"
                              ? "Respondido"
                              : "Aguardando síndico"}
                          </span>
                        )}
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
    </div>
  );
}
