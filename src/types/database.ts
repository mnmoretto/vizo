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

export type OccurrenceStatus =
  | "aberta"
  | "em_andamento"
  | "concluida";

export interface OccurrenceSummary {
  id: string;
  title: string;
  category: string;
  location: string;
  status: OccurrenceStatus;
  created_at: string;
}
