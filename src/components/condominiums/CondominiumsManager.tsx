"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  FileBadge2,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { setActiveCondoCookieClient } from "@/lib/condo-cookies";
import { formatCNPJ } from "@/lib/validators";
import { CreateCondominiumModal } from "@/components/condominiums/CreateCondominiumModal";
import { EditCondominiumModal } from "@/components/condominiums/EditCondominiumModal";
import { InviteLinkModal } from "@/components/condominiums/InviteLinkModal";
import type { CondominiumWithStats } from "@/types/database";

interface CondominiumsManagerProps {
  sindicoId: string;
  sindicoEmail: string | null;
  condominiums: CondominiumWithStats[];
  activeCondoId: string;
  schemaMissing?: boolean;
}

export function CondominiumsManager({
  sindicoId,
  sindicoEmail,
  condominiums,
  activeCondoId,
  schemaMissing = false,
}: CondominiumsManagerProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCondo, setEditCondo] = useState<CondominiumWithStats | null>(null);
  const [inviteCondo, setInviteCondo] = useState<CondominiumWithStats | null>(
    null,
  );

  function selectAndGo(condoId: string, path: string) {
    setActiveCondoCookieClient(condoId);
    router.push(path);
    router.refresh();
  }

  return (
    <div className="space-y-6 animate-vizo-fade">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Meus Condomínios
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Crie e administre quantos condomínios precisar a partir do seu login
            de síndico.
          </p>
        </div>

        <button
          id="btn-new-condominium"
          type="button"
          onClick={() => setCreateOpen(true)}
          className="vizo-btn-primary w-full sm:w-auto shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Criar condomínio</span>
        </button>
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
          no SQL Editor do Supabase para ativar o cadastro de condomínios.
        </div>
      )}

      {condominiums.length === 0 ? (
        <div className="vizo-card rounded-2xl px-6 py-14 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Building2 className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Nenhum condomínio cadastrado ainda
            </h2>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Cadastre seu primeiro condomínio informando nome, CNPJ, endereço e
              e-mail. Depois você poderá gerar links de convite para os
              moradores.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="vizo-btn-primary text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Cadastrar primeiro condomínio</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {condominiums.map((condo) => {
            const isActive = condo.id === activeCondoId;
            return (
              <article
                key={condo.id}
                className={`vizo-card rounded-2xl p-5 space-y-4 transition-colors ${
                  isActive ? "ring-2 ring-teal-600/35 border-teal-300" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200/80">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 break-words">
                          {condo.name}
                        </h2>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
                            <CheckCircle2 className="h-3 w-3" />
                            Selecionado
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 space-y-1 text-xs text-slate-600">
                        <p className="flex items-center gap-1.5 font-mono">
                          <FileBadge2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>CNPJ: {formatCNPJ(condo.cnpj)}</span>
                        </p>
                        <p className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{condo.address}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{condo.contact_email}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contadores rápidos */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-1.5 text-center">
                      <span className="block font-mono text-base font-bold text-slate-900">
                        {condo.residentsCount}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">
                        Moradores
                      </span>
                    </div>
                    <div className="rounded-xl bg-teal-50/70 border border-teal-200/80 px-3 py-1.5 text-center">
                      <span className="block font-mono text-base font-bold text-teal-900">
                        {condo.openOccurrencesCount}
                      </span>
                      <span className="text-[10px] font-medium text-teal-700">
                        Abertas
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ações do Condomínio */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setInviteCondo(condo)}
                    className="vizo-btn-primary py-2 px-3.5 text-xs sm:text-sm"
                  >
                    <Link2 className="h-4 w-4" />
                    <span>Gerar link de convite</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectAndGo(condo.id, "/condominos")}
                    className="vizo-btn-secondary py-2 px-3.5 text-xs sm:text-sm"
                  >
                    <Users className="h-4 w-4 text-teal-700" />
                    <span>Ver condôminos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectAndGo(condo.id, "/")}
                    className="vizo-btn-secondary py-2 px-3.5 text-xs sm:text-sm"
                  >
                    <ClipboardList className="h-4 w-4 text-slate-600" />
                    <span>Abrir ocorrências</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditCondo(condo)}
                    className="vizo-btn-secondary py-2 px-3.5 text-xs sm:text-sm"
                  >
                    <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    <span>Editar</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CreateCondominiumModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        sindicoId={sindicoId}
        defaultEmail={sindicoEmail}
      />

      <EditCondominiumModal
        condominium={editCondo}
        onClose={() => setEditCondo(null)}
      />

      <InviteLinkModal
        open={Boolean(inviteCondo)}
        onClose={() => setInviteCondo(null)}
        sindicoId={sindicoId}
        condominium={inviteCondo}
      />
    </div>
  );
}
