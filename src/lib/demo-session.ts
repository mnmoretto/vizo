import type { Profile } from "@/types/database";

export const DEMO_SESSION_COOKIE = "vizo_demo_profile";

export function serializeDemoProfile(profile: Profile): string {
  return encodeURIComponent(JSON.stringify(profile));
}

export function parseDemoProfile(rawValue: string | undefined): Profile | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Profile;
    if (!parsed || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function getCookieFlags(): string {
  const isHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";
  return isHttps ? "SameSite=None; Secure" : "SameSite=Lax";
}

export function setDemoProfileCookieClient(profile: Profile): void {
  const value = serializeDemoProfile(profile);
  document.cookie = `${DEMO_SESSION_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 7}; ${getCookieFlags()}`;
}

export function clearDemoProfileCookieClient(): void {
  document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0; ${getCookieFlags()}`;
}
