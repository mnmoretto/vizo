import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_SESSION_COOKIE, parseDemoProfile } from "@/lib/demo-session";
import type { Profile } from "@/types/database";

export interface SessionContext {
  isDemo: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
}

export async function getCurrentSessionProfile(): Promise<SessionContext> {
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    const demoProfile = parseDemoProfile(
      cookieStore.get(DEMO_SESSION_COOKIE)?.value,
    );

    if (!demoProfile) {
      return {
        isDemo: true,
        isAuthenticated: false,
        userId: null,
        email: null,
        profile: null,
      };
    }

    return {
      isDemo: true,
      isAuthenticated: true,
      userId: demoProfile.id,
      email: demoProfile.email,
      profile: demoProfile,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isDemo: false,
      isAuthenticated: false,
      userId: null,
      email: null,
      profile: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return {
    isDemo: false,
    isAuthenticated: true,
    userId: user.id,
    email: user.email ?? null,
    profile: profile ?? {
      id: user.id,
      email: user.email ?? null,
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      cpf: null,
      phone: null,
      block: null,
      unit: null,
      role: "morador",
      onboarding_completed: false,
    },
  };
}
