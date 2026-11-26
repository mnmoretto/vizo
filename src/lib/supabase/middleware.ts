import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "./config";
import { DEMO_SESSION_COOKIE, parseDemoProfile } from "@/lib/demo-session";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/convite"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    return NextResponse.redirect(
      new URL(pathname, `${forwardedProto}://${forwardedHost}`),
    );
  }

  const host = request.headers.get("host");
  if (host) {
    const proto = request.nextUrl.protocol.replace(":", "") || "http";
    return NextResponse.redirect(new URL(pathname, `${proto}://${host}`));
  }

  const targetUrl = request.nextUrl.clone();
  targetUrl.pathname = pathname;
  targetUrl.search = "";
  return NextResponse.redirect(targetUrl);
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Modo Demonstração (quando variáveis do Supabase ainda não foram configuradas)
  if (!isSupabaseConfigured()) {
    const demoProfile = parseDemoProfile(
      request.cookies.get(DEMO_SESSION_COOKIE)?.value,
    );

    if (!demoProfile && !isPublicPath(pathname)) {
      return redirectTo(request, "/login");
    }

    if (demoProfile) {
      if (!demoProfile.onboarding_completed && pathname !== "/onboarding") {
        return redirectTo(request, "/onboarding");
      }

      if (
        demoProfile.onboarding_completed &&
        (pathname === "/login" || pathname === "/onboarding")
      ) {
        return redirectTo(request, "/");
      }
    }

    return NextResponse.next({ request });
  }

  // Modo Produção / Supabase
  let supabaseResponse = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Permite finalizar callback OAuth e redefinição de senha sem interceptação
  if (
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/redefinir-senha")
  ) {
    return supabaseResponse;
  }

  // Sem usuário autenticado -> redireciona para /login
  if (!user && !isPublicPath(pathname)) {
    return redirectTo(request, "/login");
  }

  // Usuário autenticado -> verifica obrigatoriedade do onboarding
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle<{ onboarding_completed: boolean }>();

    const onboardingCompleted = Boolean(profile?.onboarding_completed);

    if (!onboardingCompleted && pathname !== "/onboarding") {
      return redirectTo(request, "/onboarding");
    }

    if (
      onboardingCompleted &&
      (pathname === "/login" || pathname === "/onboarding")
    ) {
      return redirectTo(request, "/");
    }
  }

  return supabaseResponse;
}
