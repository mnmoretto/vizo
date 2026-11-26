"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Ban,
  Building2,
  Check,
  Copy,
  DoorOpen,
  IdCard,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CondominiumSwitcher } from "@/components/condominiums/CondominiumSwitcher";
import { CreateCondominiumModal } from "@/components/condominiums/CreateCondominiumModal";
import { InviteLinkModal } from "@/components/condominiums/InviteLinkModal";
import { formatCPF, formatPhone, onlyDigits } from "@/lib/validators";
import { formatDateTimeBR } from "@/lib/occurrences";
import type {
  CondominiumInvite,
  CondominiumWithStats,
  ResidentSummary,
  ResidentUnitGroup,
} from "@/types/database";

interface ResidentsDirectoryProps {
  sindicoId: string;
  sindicoEmail: string | null;
  condominiums: CondominiumWithStats[];
  activeCondoId: string;
  groups: ResidentUnitGroup[];
  totalResidents: number;
  invites: CondominiumInvite[];
  schemaMissing?: boolean;
}

type DirectoryTab = "moradores" | "convites";

function getInviteStatus(invite: CondominiumInvite): {
  label: string;
  active: boolean;
  badgeClass: string;
} {
  if (invite.revoked_at) {
    return {
      label: "Revogado",
      active: false,
      badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
    };
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return {
      label: "Expirado",
      active: false,
      badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
    };
  }
  if (invite.uses_count >= invite.max_uses) {
    return {
      label: "Esgotado",
      active: false,
      badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",
    };
  }
  return {
    label: "Ativo",
    active: true,
    badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  };
}

export function ResidentsDirectory({
  sindicoId,
  sindicoEmail,
  condominiums,
  activeCondoId,
  groups,
  totalResidents,
  invites,
  schemaMissing = false,
}: ResidentsDirectoryProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DirectoryTab>("moradores");
  const [searchQuery, setSearchQuery] = useState("");
  const [blockFilter, setBlockFilter] = useState("todos");

  const [createCondoOpen, setCreateCondoOpen] = useState(false);
  const [inviteModalState, setInviteModalState] = useState<{
    open: boolean;
    block: string;
    unit: string;
  }>({ open: false, block: "", unit: "" });

  // Ações sobre convites (com confirmação para evitar clique acidental)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Gestão de moradores: editar unidade e desvincular
  const [editResident, setEditResident] = useState<ResidentSummary | null>(null);
  const [editBlock, setEditBlock] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [removeResident, setRemoveResident] = useState<ResidentSummary | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const activeCondo =
    condominiums.find((c) => c.id === activeCondoId) ?? condominiums[0] ?? null;

  const availableBlocks = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      if (g.block) set.add(g.block);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true }),
    );
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return groups.filter((group) => {
      if (
        blockFilter !== "todos" &&
        group.block.toLowerCase() !== blockFilter.toLowerCase()
      ) {
        return false;
      }

      if (!q) return true;

      const unitMatch = `${group.block} ${group.unit}`
        .toLowerCase()
        .includes(q);
      if (unitMatch) return true;

      return group.residents.some((r) => {
        const name = (r.full_name ?? "").toLowerCase();
        const email = (r.email ?? "").toLowerCase();
        const cpf = (r.cpf ?? "").toLowerCase();
        return name.includes(q) || email.includes(q) || cpf.includes(q);
      });
    });
  }, [groups, blockFilter, searchQuery]);

  async function handleCopyInvite(invite: CondominiumInvite) {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/convite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteId(invite.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch {
      // Clipboard indisponível
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setRevokingId(inviteId);
    try {
      const supabase = createClient();
      await supabase
        .from("condominium_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", inviteId);
      setConfirmRevokeId(null);
      router.refresh();
    } finally {
      setRevokingId(null);
    }
  }

  function openEditUnitModal(resident: ResidentSummary) {
    setEditResident(resident);
    setEditBlock(resident.block ?? "");
    setEditUnit(resident.unit ?? "");
    setEditError(null);
  }

  async function handleSaveResidentUnit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!editResident) return;

    if (!editBlock.trim() || !editUnit.trim()) {
      setEditError("Preencha o bloco/torre e o número do apartamento/casa.");
      return;
    }

    setEditError(null);
    setEditSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("sindico_update_resident_unit", {
        p_resident_id: editResident.id,
        p_block: editBlock.trim(),
        p_unit: editUnit.trim(),
      });

      if (error) {
        setEditError(error.message || "Não foi possível atualizar a unidade.");
        return;
      }

      setEditResident(null);
      router.refresh();
    } catch {
      setEditError("Erro inesperado ao salvar a nova unidade.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConfirmRemoveResident() {
    if (!removeResident) return;
    setRemoveError(null);
    setRemoving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("sindico_remove_resident", {
        p_resident_id: removeResident.id,
      });

      if (error) {
        setRemoveError(
          error.message || "Não foi possível desvincular este morador.",
        );
        return;
      }

      setRemoveResident(null);
      router.refresh();
    } catch {
      setRemoveError("Erro inesperado ao desvincular o morador.");
    } finally {
      setRemoving(false);
    }
  }

  function buildWhatsAppUrl(invite: CondominiumInvite): string {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/convite/${invite.token}`
        : `/convite/${invite.token}`;
    const unitInfo = [invite.prefilled_block, invite.prefilled_unit]
      .filter(Boolean)
      .join(" · ");
    const text = `Olá! Você foi convidado(a) para o Vizo do condomínio *${activeCondo?.name ?? ""}*${unitInfo ? ` (${unitInfo})` : ""}.\n\nCrie seu cadastro por este link:\n${url}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="space-y-6 animate-vizo-fade">
      {/* Cabeçalho */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Condôminos &amp; Convites
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Moradores organizados por bloco e apartamento/casa e gestão de links
            de convite.
          </p>
        </div>
      </section>

      {schemaMissing && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-xs text-amber-950"
        >
          Execute o script{" "}
          <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded">
            supabase/stage4_condominiums.sql
          </code>{" "}
          no SQL Editor do Supabase para ativar o módulo de condomínios e
          convites.
        </div>
      )}

      {/* Seletor de Condomínio */}
      {condominiums.length > 0 ? (
        <CondominiumSwitcher
          sindicoId={sindicoId}
          sindicoEmail={sindicoEmail}
          condominiums={condominiums}
          activeCondoId={activeCondo?.id ?? ""}
        />
      ) : (
        <div className="vizo-card rounded-2xl px-6 py-12 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Building2 className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Cadastre seu primeiro condomínio
            </h2>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Antes de gerar links de convite ou visualizar os condôminos,
              cadastre o condomínio com CNPJ, endereço e e-mail.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateCondoOpen(true)}
            className="vizo-btn-primary text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Cadastrar condomínio</span>
          </button>
        </div>
      )}

      {activeCondo && (
        <>
          {/* Alternador: Condôminos por Unidade / Links de Convite */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              className="inline-grid grid-cols-2 rounded-xl bg-slate-200/70 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "moradores"}
                onClick={() => setActiveTab("moradores")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "moradores"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Condôminos ({totalResidents})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "convites"}
                onClick={() => setActiveTab("convites")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "convites"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Link2 className="h-4 w-4" />
                <span>Convites ({invites.length})</span>
              </button>
            </div>

            <span className="text-xs font-medium text-slate-500">
              {groups.length} unidade{groups.length === 1 ? "" : "s"} ocupada
              {groups.length === 1 ? "" : "s"}
            </span>
          </div>

          {activeTab === "moradores" ? (
            <div className="space-y-4">
              {/* Filtros da lista de condôminos */}
              <div className="vizo-card rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label
                    htmlFor="residents-search"
                    className="block text-xs font-semibold text-slate-600 mb-1"
                  >
                    Buscar morador ou unidade
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="residents-search"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Nome, CPF, bloco ou número do apartamento..."
                      className="vizo-input pl-11 pr-9 py-2.5 text-sm"
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

                <div className="sm:col-span-4">
                  <label
                    htmlFor="residents-block-filter"
                    className="block text-xs font-semibold text-slate-600 mb-1"
                  >
                    Filtrar por Bloco / Torre
                  </label>
                  <select
                    id="residents-block-filter"
                    value={blockFilter}
                    onChange={(e) => setBlockFilter(e.target.value)}
                    className="vizo-input py-2.5 text-sm bg-white"
                  >
                    <option value="todos">Todos os blocos</option>
                    {availableBlocks.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lista agrupada por Bloco + Apartamento/Casa */}
              {filteredGroups.length === 0 ? (
                <div className="vizo-card rounded-2xl px-6 py-12 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <Users className="h-6 w-6" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {groups.length === 0
                      ? "Nenhum condômino cadastrado ainda"
                      : "Nenhuma unidade encontrada"}
                  </h2>
                  <p className="mx-auto max-w-md text-sm text-slate-500">
                    {groups.length === 0
                      ? "Gere um link de convite e compartilhe com os moradores para que eles criem o acesso neste condomínio."
                      : "Tente limpar ou ajustar o filtro de busca."}
                  </p>
                  {groups.length === 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setInviteModalState({ open: true, block: "", unit: "" })
                      }
                      className="vizo-btn-primary text-sm mt-2"
                    >
                      <Link2 className="h-4 w-4" />
                      <span>Gerar primeiro convite</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredGroups.map((group) => (
                    <article
                      key={group.key}
                      className="vizo-card rounded-2xl overflow-hidden"
                    >
                      {/* Cabeçalho da Unidade Agrupada */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 sm:px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white shrink-0">
                            <DoorOpen className="h-4 w-4" />
                          </div>
                          <div>
                            <h2 className="text-sm sm:text-base font-bold text-slate-900">
                              {group.block} · {group.unit}
                            </h2>
                            <p className="text-xs text-slate-500">
                              {group.residents.length}{" "}
                              {group.residents.length === 1
                                ? "morador cadastrado"
                                : "moradores agrupados nesta unidade"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setInviteModalState({
                              open: true,
                              block: group.block,
                              unit: group.unit,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 transition-colors cursor-pointer"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Convidar para esta unidade</span>
                        </button>
                      </div>

                      {/* Moradores pertencentes a esta unidade */}
                      <ul className="divide-y divide-slate-100">
                        {group.residents.map((resident) => {
                          const phoneDigits = resident.phone
                            ? onlyDigits(resident.phone)
                            : "";
                          return (
                            <li
                              key={resident.id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3.5"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800 font-bold text-sm border border-teal-200/70">
                                  {(resident.full_name ?? "M")
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <p className="text-sm font-semibold text-slate-900 truncate">
                                    {resident.full_name || "Morador"}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                    {resident.email && (
                                      <span className="inline-flex items-center gap-1 truncate">
                                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                        <span className="truncate">
                                          {resident.email}
                                        </span>
                                      </span>
                                    )}
                                    {resident.cpf && (
                                      <span className="inline-flex items-center gap-1 font-mono">
                                        <IdCard className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                        {formatCPF(resident.cpf)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {phoneDigits && (
                                  <a
                                    href={`https://wa.me/55${phoneDigits}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/70 transition-colors"
                                  >
                                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="font-mono">
                                      {formatPhone(phoneDigits)}
                                    </span>
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openEditUnitModal(resident)}
                                  title="Editar unidade"
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">
                                    Unidade
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemoveResident(resident);
                                    setRemoveError(null);
                                  }}
                                  title="Desvincular morador"
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">
                                    Desvincular
                                  </span>
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Aba de Links de Convite Gerados */
            <div className="space-y-3">
              {invites.length === 0 ? (
                <div className="vizo-card rounded-2xl px-6 py-12 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <Link2 className="h-6 w-6" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Nenhum link de convite gerado ainda
                  </h2>
                  <p className="mx-auto max-w-md text-sm text-slate-500">
                    Clique em &quot;Gerar link de convite&quot; para criar um
                    acesso seguro e enviar aos moradores.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setInviteModalState({ open: true, block: "", unit: "" })
                    }
                    className="vizo-btn-primary text-sm"
                  >
                    <Link2 className="h-4 w-4" />
                    <span>Gerar link de convite</span>
                  </button>
                </div>
              ) : (
                invites.map((invite) => {
                  const status = getInviteStatus(invite);
                  const unitTag = [invite.prefilled_block, invite.prefilled_unit]
                    .filter(Boolean)
                    .join(" · ");
                  const isConfirmingRevoke = confirmRevokeId === invite.id;

                  return (
                    <div
                      key={invite.id}
                      className="vizo-card rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.badgeClass}`}
                          >
                            {status.label}
                          </span>
                          <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {invite.uses_count}/{invite.max_uses} uso
                            {invite.max_uses > 1 ? "s" : ""}
                          </span>
                          {unitTag && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">
                              <Building2 className="h-3 w-3" />
                              {unitTag}
                            </span>
                          )}
                        </div>

                        <p className="font-mono text-xs text-slate-500 truncate">
                          /convite/{invite.token}
                          {invite.target_email
                            ? ` · ${invite.target_email}`
                            : ""}
                        </p>

                        <p className="text-[11px] text-slate-400">
                          Criado em {formatDateTimeBR(invite.created_at)}
                          {invite.expires_at
                            ? ` · Expira em ${formatDateTimeBR(invite.expires_at)}`
                            : " · Sem expiração"}
                        </p>
                      </div>

                      {status.active && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isConfirmingRevoke ? (
                            <>
                              <span className="text-xs font-semibold text-rose-800">
                                Revogar link?
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRevokeInvite(invite.id)}
                                disabled={revokingId === invite.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 cursor-pointer disabled:opacity-50"
                              >
                                {revokingId === invite.id && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                )}
                                <span>Sim, revogar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeId(null)}
                                disabled={revokingId === invite.id}
                                className="vizo-btn-secondary py-1.5 px-2.5 text-xs"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopyInvite(invite)}
                                className="vizo-btn-secondary py-1.5 px-3 text-xs"
                              >
                                {copiedInviteId === invite.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-emerald-700">
                                      Copiado
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>

                              <a
                                href={buildWhatsAppUrl(invite)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="vizo-btn-secondary py-1.5 px-3 text-xs border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                              >
                                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                                <span>WhatsApp</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => setConfirmRevokeId(invite.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                <span>Revogar</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Editar Bloco/Apto do morador */}
      {editResident && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!editSaving) setEditResident(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-vizo-fade"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Alterar unidade do morador
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editResident.full_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !editSaving && setEditResident(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveResidentUnit} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-resident-block"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Bloco / Torre
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="edit-resident-block"
                    type="text"
                    required
                    value={editBlock}
                    onChange={(e) => setEditBlock(e.target.value)}
                    className="vizo-input pl-11"
                    disabled={editSaving}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-resident-unit"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Apartamento / Casa
                </label>
                <div className="relative">
                  <DoorOpen className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="edit-resident-unit"
                    type="text"
                    required
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="vizo-input pl-11"
                    disabled={editSaving}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditResident(null)}
                  disabled={editSaving}
                  className="vizo-btn-secondary w-full sm:w-auto text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="vizo-btn-primary w-full sm:w-auto text-sm"
                >
                  {editSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>Salvar unidade</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmação para desvincular morador */}
      {removeResident && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!removing) setRemoveResident(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-vizo-fade"
          >
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900">
                Desvincular morador do condomínio?
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong>{removeResident.full_name}</strong> ({removeResident.block}{" "}
                · {removeResident.unit}) perderá o acesso a este condomínio e
                precisará de um novo convite para entrar novamente. O histórico
                de ocorrências já registradas será preservado.
              </p>
            </div>

            {removeError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{removeError}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRemoveResident(null)}
                disabled={removing}
                className="vizo-btn-secondary w-full sm:w-auto text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveResident}
                disabled={removing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-800 transition-colors cursor-pointer disabled:opacity-50 w-full sm:w-auto"
              >
                {removing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserMinus className="h-4 w-4" />
                )}
                <span>Confirmar desvinculação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateCondominiumModal
        open={createCondoOpen}
        onClose={() => setCreateCondoOpen(false)}
        sindicoId={sindicoId}
        defaultEmail={sindicoEmail}
      />

      <InviteLinkModal
        open={inviteModalState.open}
        onClose={() =>
          setInviteModalState({ open: false, block: "", unit: "" })
        }
        sindicoId={sindicoId}
        condominium={activeCondo}
        initialBlock={inviteModalState.block}
        initialUnit={inviteModalState.unit}
      />
    </div>
  );
}
