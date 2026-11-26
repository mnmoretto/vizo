const ACTIVE_CONDO_COOKIE = "vizo_active_condo";
const INVITE_TOKEN_COOKIE = "vizo_invite_token";

function getCookieFlags(): string {
  const isHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";
  return isHttps ? "SameSite=None; Secure" : "SameSite=Lax";
}

export function setActiveCondoCookieClient(condoId: string): void {
  document.cookie = `${ACTIVE_CONDO_COOKIE}=${encodeURIComponent(condoId)}; path=/; max-age=${60 * 60 * 24 * 30}; ${getCookieFlags()}`;
}

export function clearActiveCondoCookieClient(): void {
  document.cookie = `${ACTIVE_CONDO_COOKIE}=; path=/; max-age=0; ${getCookieFlags()}`;
}

export function setInviteTokenCookieClient(token: string): void {
  document.cookie = `${INVITE_TOKEN_COOKIE}=${encodeURIComponent(token.trim())}; path=/; max-age=${60 * 60 * 24}; ${getCookieFlags()}`;
}

export function clearInviteTokenCookieClient(): void {
  document.cookie = `${INVITE_TOKEN_COOKIE}=; path=/; max-age=0; ${getCookieFlags()}`;
}
