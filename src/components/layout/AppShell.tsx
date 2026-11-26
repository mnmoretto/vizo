"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Loader2,
  LogOut,
  Shield,
  UserCircle2,
} from "lucide-react";
import { VizoLogo } from "@/components/brand/VizoLogo";
import { createClient } from "@/lib/supabase/client";
import { clearDemoProfileCookieClient } from "@/lib/demo-session";
import type { Profile } from "@/types/database";

interface AppShellProps {
  profile: Profile;
  isDemo: boolean;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  {
    href: "/",
    label: "Ocorrências",
    icon: ClipboardList,
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: UserCircle2,
  },
];

export function AppShell({ profile, isDemo, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const unitLabel = [profile.block, profile.unit].filter(Boolean).join(" · ");
  const roleLabel = profile.role === "sindico" ? "Síndico" : "Morador";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      if (isDemo) {
        clearDemoProfileCookieClient();
      } else {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Faixa discreta se estiver em modo demonstração */}
      {isDemo && (
        <div className="bg-teal-900 text-teal-50 text-xs py-1.5 px-4 text-center">
          Modo demonstração local — configure{" "}
          <code className="font-mono bg-teal-800 px-1 py-0.5 rounded">
            .env.local
          </code>{" "}
          para conectar ao seu Supabase.
        </div>
      )}

      {/* Top Bar Responsiva */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg"
            >
              <VizoLogo size="sm" />
            </Link>

            {/* Navegação Desktop */}
            <nav
              aria-label="Navegação principal"
              className="hidden md:flex items-center gap-1"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/" || pathname.startsWith("/ocorrencias")
                    : pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-teal-50 text-teal-800"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Identificação da Unidade + Sair */}
          <div className="flex items-center gap-2.5">
            {unitLabel && (
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-teal-700" />
                <span>{unitLabel}</span>
              </div>
            )}

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                profile.role === "sindico"
                  ? "bg-amber-50 text-amber-800 border border-amber-200/80"
                  : "bg-teal-50 text-teal-800 border border-teal-200/70"
              }`}
            >
              {profile.role === "sindico" && <Shield className="h-3 w-3" />}
              {roleLabel}
            </span>

            <button
              id="btn-header-signout"
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sair da conta"
              title="Sair"
              className="inline-flex items-center gap-1.5 rounded-lg border border-transparent p-2 text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="hidden sm:inline text-xs font-medium">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Área de Conteúdo Principal */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-12">
        {children}
      </main>

      {/* Bottom Navigation Mobile-First */}
      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-2 px-4 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/" || pathname.startsWith("/ocorrencias")
                : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "text-teal-700"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    isActive ? "bg-teal-50" : "bg-transparent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
