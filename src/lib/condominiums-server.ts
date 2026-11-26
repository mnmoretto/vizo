import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Condominium,
  CondominiumInvite,
  CondominiumWithStats,
  InvitePreview,
  ResidentSummary,
  ResidentUnitGroup,
} from "@/types/database";

export const ACTIVE_CONDO_COOKIE = "vizo_active_condo";
export const INVITE_TOKEN_COOKIE = "vizo_invite_token";

function isMissingRelationError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    Boolean(error.message?.toLowerCase().includes("could not find the table"))
  );
}

/**
 * Valida e retorna prévia segura de um token de convite (funciona sem login).
 */
export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const cleanToken = token.trim();
  if (!cleanToken || !isSupabaseConfigured()) {
    return { valid: false, reason: "not_found" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invite_preview", {
    p_token: cleanToken,
  });

  if (error || !data) {
    return { valid: false, reason: "not_found" };
  }

  return data as InvitePreview;
}

/**
 * Lê o token de convite armazenado em cookie (usado para preservar o convite
 * durante o redirecionamento do Google OAuth e no onboarding).
 */
export async function getStoredInviteToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(INVITE_TOKEN_COOKIE)?.value?.trim();
  return value || null;
}

/**
 * Retorna o ID do condomínio selecionado atualmente pelo síndico (cookie).
 */
export async function getActiveCondoCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_CONDO_COOKIE)?.value?.trim();
  return value || null;
}

/**
 * Lista todos os condomínios geridos pelo síndico autenticado com estatísticas.
 */
export async function listSindicoCondominiums(sindicoId: string): Promise<{
  condominiums: CondominiumWithStats[];
  schemaMissing: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { condominiums: [], schemaMissing: false };
  }

  const supabase = await createClient();
  const { data: condos, error } = await supabase
    .from("condominiums")
    .select("*")
    .eq("sindico_id", sindicoId)
    .order("created_at", { ascending: false })
    .returns<Condominium[]>();

  if (error) {
    if (isMissingRelationError(error)) {
      return { condominiums: [], schemaMissing: true };
    }
    return { condominiums: [], schemaMissing: false };
  }

  if (!condos || condos.length === 0) {
    return { condominiums: [], schemaMissing: false };
  }

  const condoIds = condos.map((c) => c.id);

  const [residentsRes, occurrencesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, condominium_id")
      .in("condominium_id", condoIds)
      .eq("role", "morador"),
    supabase
      .from("occurrences")
      .select("id, condominium_id, status")
      .in("condominium_id", condoIds),
  ]);

  const residentCountMap = new Map<string, number>();
  for (const row of residentsRes.data ?? []) {
    if (row.condominium_id) {
      residentCountMap.set(
        row.condominium_id,
        (residentCountMap.get(row.condominium_id) ?? 0) + 1,
      );
    }
  }

  const openOccMap = new Map<string, number>();
  const totalOccMap = new Map<string, number>();
  for (const row of occurrencesRes.data ?? []) {
    if (row.condominium_id) {
      totalOccMap.set(
        row.condominium_id,
        (totalOccMap.get(row.condominium_id) ?? 0) + 1,
      );
      if (row.status === "aberto") {
        openOccMap.set(
          row.condominium_id,
          (openOccMap.get(row.condominium_id) ?? 0) + 1,
        );
      }
    }
  }

  const condominiums: CondominiumWithStats[] = condos.map((condo) => ({
    ...condo,
    residentsCount: residentCountMap.get(condo.id) ?? 0,
    openOccurrencesCount: openOccMap.get(condo.id) ?? 0,
    totalOccurrencesCount: totalOccMap.get(condo.id) ?? 0,
  }));

  return { condominiums, schemaMissing: false };
}

/**
 * Busca o condomínio vinculado a um morador (para exibir nome no cabeçalho/perfil).
 */
export async function getCondominiumById(
  condominiumId: string | null | undefined,
): Promise<Condominium | null> {
  if (!condominiumId || !isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("condominiums")
    .select("*")
    .eq("id", condominiumId)
    .maybeSingle<Condominium>();

  return data ?? null;
}

/**
 * Lista todos os moradores de um condomínio agrupados por unidade (Bloco + Apto/Casa).
 */
export async function listCondominiumResidentsGrouped(
  condominiumId: string,
): Promise<{
  groups: ResidentUnitGroup[];
  totalResidents: number;
  schemaMissing: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { groups: [], totalResidents: 0, schemaMissing: false };
  }

  const supabase = await createClient();
  const { data: residents, error } = await supabase
    .from("profiles")
    .select("id, full_name, cpf, block, unit, phone, email, condominium_id, created_at")
    .eq("condominium_id", condominiumId)
    .eq("role", "morador")
    .eq("onboarding_completed", true)
    .order("block", { ascending: true })
    .order("unit", { ascending: true })
    .order("full_name", { ascending: true })
    .returns<ResidentSummary[]>();

  if (error) {
    if (isMissingRelationError(error)) {
      return { groups: [], totalResidents: 0, schemaMissing: true };
    }
    return { groups: [], totalResidents: 0, schemaMissing: false };
  }

  const rows = residents ?? [];
  const groupMap = new Map<string, ResidentUnitGroup>();

  for (const resident of rows) {
    const rawBlock = (resident.block ?? "Sem bloco").trim() || "Sem bloco";
    const rawUnit = (resident.unit ?? "Sem unidade").trim() || "Sem unidade";
    const normalizedKey = `${rawBlock.toLowerCase()}::${rawUnit.toLowerCase()}`;

    const existing = groupMap.get(normalizedKey);
    if (existing) {
      existing.residents.push(resident);
    } else {
      groupMap.set(normalizedKey, {
        key: normalizedKey,
        block: rawBlock,
        unit: rawUnit,
        residents: [resident],
      });
    }
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const blockCmp = a.block.localeCompare(b.block, "pt-BR", { numeric: true });
    if (blockCmp !== 0) return blockCmp;
    return a.unit.localeCompare(b.unit, "pt-BR", { numeric: true });
  });

  return { groups, totalResidents: rows.length, schemaMissing: false };
}

/**
 * Lista os links de convite gerados para um condomínio.
 */
export async function listCondominiumInvites(
  condominiumId: string,
): Promise<{
  invites: CondominiumInvite[];
  schemaMissing: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { invites: [], schemaMissing: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("condominium_invites")
    .select("*")
    .eq("condominium_id", condominiumId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<CondominiumInvite[]>();

  if (error) {
    if (isMissingRelationError(error)) {
      return { invites: [], schemaMissing: true };
    }
    return { invites: [], schemaMissing: false };
  }

  return { invites: data ?? [], schemaMissing: false };
}
