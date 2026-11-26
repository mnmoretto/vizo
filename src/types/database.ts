export type UserRole = "morador" | "sindico";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  block: string | null;
  unit: string | null;
  role: UserRole;
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

export type RoomOption = (typeof ROOM_OPTIONS)[number];

export interface Occurrence {
  id: string;
  protocol: string;
  user_id: string;
  room: string;
  description: string;
  status: OccurrenceStatus;
  created_at: string;
  updated_at: string;
}

export interface ResidentSummary {
  id: string;
  full_name: string | null;
  block: string | null;
  unit: string | null;
  phone: string | null;
  email: string | null;
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
  resident?: ResidentSummary | null;
}

export interface OccurrenceDetailData extends Occurrence {
  resident?: ResidentSummary | null;
  initialPhotos: OccurrencePhoto[];
  updates: OccurrenceUpdate[];
}
