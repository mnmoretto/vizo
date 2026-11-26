"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Link2, Plus } from "lucide-react";
import { setActiveCondoCookieClient } from "@/lib/condo-cookies";
import { CreateCondominiumModal } from "@/components/condominiums/CreateCondominiumModal";
import { InviteLinkModal } from "@/components/condominiums/InviteLinkModal";
import type { CondominiumWithStats } from "@/types/database";

interface CondominiumSwitcherProps {
  sindicoId: string;
  sindicoEmail: string | null;
  condominiums: CondominiumWithStats[];
  activeCondoId: string;
  allowAllOption?: boolean;
}

export function CondominiumSwitcher({
  sindicoId,
  sindicoEmail,
  condominiums,
  activeCondoId,
  allowAllOption = false,
}: CondominiumSwitcherProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const selectedCondo =
    condominiums.find((c) => c.id === activeCondoId) ?? condominiums[0] ?? null;

  function handleSelectChange(nextId: string) {
    setActiveCondoCookieClient(nextId);
    router.refresh();
  }

  return (
    <>
      <div className="vizo-card rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200/70">
            <Building2 className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <label
              htmlFor="active-condo-select"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
            >
              Condomínio ativo
            </label>
            {condominiums.length === 0 ? (
              <p className="text-sm font-semibold text-slate-700 truncate">
                Nenhum condomínio cadastrado
              </p>
            ) : (
              <select
                id="active-condo-select"
                value={activeCondoId}
                onChange={(e) => handleSelectChange(e.target.value)}
                className="mt-0.5 w-full max-w-xs bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer truncate"
              >
                {allowAllOption && condominiums.length > 1 && (
                  <option value="all">
                    Todos os condomínios ({condominiums.length})
                  </option>
                )}
                {condominiums.map((condo) => (
                  <option key={condo.id} value={condo.id}>
                    {condo.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Botões rápidos do síndico */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedCondo && (
            <button
              id="btn-open-invite-modal"
              type="button"
              onClick={() => setInviteOpen(true)}
              className="vizo-btn-primary flex-1 sm:flex-initial py-2 px-3.5 text-xs sm:text-sm"
            >
              <Link2 className="h-4 w-4" />
              <span>Gerar link de convite</span>
            </button>
          )}

          <button
            id="btn-open-create-condo"
            type="button"
            onClick={() => setCreateOpen(true)}
            className="vizo-btn-secondary flex-1 sm:flex-initial py-2 px-3.5 text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4 text-teal-700" />
            <span>Novo condomínio</span>
          </button>
        </div>
      </div>

      <CreateCondominiumModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        sindicoId={sindicoId}
        defaultEmail={sindicoEmail}
      />

      <InviteLinkModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        sindicoId={sindicoId}
        condominium={selectedCondo}
      />
    </>
  );
}
