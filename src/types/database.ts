export type UserRole = "morador" | "sindico";

export interface Condominium {
  id: string;
  sindico_id: string;
  name: string;
  cnpj: string;
  address: string;
  contact_email: string;
  created_at: string;
  updated_at: string;
}

export interface CondominiumWithStats extends Condominium {
  residentsCount: number;
  openOccurrencesCount: number;
  totalOccurrencesCount: number;
}

export interface CondominiumInvite {
  id: string;
  condominium_id: string;
  created_by: string;
  token: string;
  prefilled_block: string | null;
  prefilled_unit: string | null;
  target_email: string | null;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface InvitePreview {
  valid: boolean;
  reason?: "not_found" | "revoked" | "expired" | "exhausted" | null;
  token?: string;
  condominium_id?: string;
  condominium_name?: string;
  condominium_address?: string;
  prefilled_block?: string | null;
  prefilled_unit?: string | null;
  target_email?: string | null;
  expires_at?: string | null;
  remaining_uses?: number;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  block: string | null;
  unit: string | null;
  role: UserRole;
  condominium_id?: string | null;
  onboarding_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingPayload {
  full_name: string;
  cpf: string;
  phone: string;
  block: string;
  unit: string;
}

export type OccurrenceStatus = "aberto" | "resolvido" | "cancelado";
export type OccurrenceScope = "unidade" | "area_comum";
export type OccurrencePriority = "normal" | "alta" | "emergencia";

export const ROOM_OPTIONS = [
  "Sala",
  "Cozinha",
  "Banheiro Social",
  "Suíte",
  "Quarto",
  "Área de Serviço",
  "Varanda",
  "Garagem",
  "Outro",
] as const;

export const COMMON_AREA_OPTIONS = [
  "Elevador",
  "Garagem",
  "Portaria / Hall",
  "Corredor / Escada",
  "Piscina / Lazer",
  "Salão de Festas",
  "Área Externa / Jardim",
  "Telhado / Caixa d'Água",
  "Casa de Bombas / Elétrica",
  "Outro",
] as const;

export const CATEGORY_OPTIONS = [
  "Hidráulica",
  "Elétrica",
  "Infiltração",
  "Estrutural",
  "Limpeza",
  "Barulho / Convivência",
  "Equipamentos",
  "Outro",
] as const;

export type RoomOption = (typeof ROOM_OPTIONS)[number];
export type CommonAreaOption = (typeof COMMON_AREA_OPTIONS)[number];
export type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

export interface Occurrence {
  id: string;
  protocol: string;
  user_id: string;
  condominium_id?: string | null;
  room: string;
  scope?: OccurrenceScope | null;
  category?: string | null;
  priority?: OccurrencePriority | null;
  description: string;
  status: OccurrenceStatus;
  created_at: string;
  updated_at: string;
}

export interface ResidentSummary {
  id: string;
  full_name: string | null;
  cpf?: string | null;
  block: string | null;
  unit: string | null;
  phone: string | null;
  email: string | null;
  condominium_id?: string | null;
  created_at?: string;
}

export interface ResidentUnitGroup {
  key: string;
  block: string;
  unit: string;
  residents: ResidentSummary[];
}

export interface OccurrencePhoto {
  id: string;
  occurrence_id: string;
  update_id: string | null;
  user_id: string;
  storage_path: string;
  captured_at: string;
  created_at: string;
  signedUrl?: string | null;
}

export interface OccurrenceUpdate {
  id: string;
  occurrence_id: string;
  user_id: string;
  comment: string | null;
  status_change?: OccurrenceStatus | null;
  created_at: string;
  author_name?: string | null;
  author_role?: UserRole;
  photos: OccurrencePhoto[];
}

export interface OccurrenceListItem extends Occurrence {
  thumbnailUrl: string | null;
  photosCount: number;
  updatesCount: number;
  lastUpdateAuthorRole?: UserRole | null;
  resident?: ResidentSummary | null;
}

export interface OccurrenceDetailData extends Occurrence {
  resident?: ResidentSummary | null;
  condominium?: Pick<Condominium, "id" | "name" | "cnpj" | "address"> | null;
  initialPhotos: OccurrencePhoto[];
  updates: OccurrenceUpdate[];
}
