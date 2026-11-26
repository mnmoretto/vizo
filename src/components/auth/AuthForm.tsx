"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setDemoProfileCookieClient } from "@/lib/demo-session";
import { setInviteTokenCookieClient } from "@/lib/condo-cookies";
import { extractInviteToken } from "@/lib/validators";
import type { InvitePreview } from "@/types/database";

interface AuthFormProps {
  isDemo: boolean;
  initialError?: string | null;
  invitePreview?: InvitePreview | null;
  initialMode?: "login" | "signup";
}

type AuthMode = "login" | "signup";

function translateSupabaseError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Verifique e tente novamente.";
  }
  if (normalized.includes("user already registered")) {
    return "Este e-mail já está cadastrado. Tente fazer login.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de acessar sua conta.";
  }
  if (normalized.includes("password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (normalized.includes("rate limit")) {
    return "Muitas tentativas em sequência. Aguarde alguns instantes.";
  }
  return "Não foi possível concluir a autenticação. Tente novamente.";
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthForm({
  isDemo,
  initialError,
  invitePreview = null,
  initialMode = "login",
}: AuthFormProps) {
  const router = useRouter();
  const hasValidInvite = Boolean(invitePreview?.valid && invitePreview.token);

  const [mode, setMode] = useState<AuthMode>(
    hasValidInvite && initialMode === "signup" ? "signup" : initialMode,
  );
  const [email, setEmail] = useState(invitePreview?.target_email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [manualInviteInput, setManualInviteInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError ?? null,
  );
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Persiste token de convite em cookie para sobreviver ao redirect do Google OAuth
  useEffect(() => {
    if (invitePreview?.valid && invitePreview.token) {
      setInviteTokenCookieClient(invitePreview.token);
    }
  }, [invitePreview]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setInfoMessage(null);
  }

  function handleRedeemManualInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = extractInviteToken(manualInviteInput);
    if (!token) {
      setErrorMessage("Cole o link ou código de convite enviado pelo síndico.");
      return;
    }
    router.push(`/convite/${encodeURIComponent(token)}`);
  }

  function startDemoSession(demoEmail: string, demoName?: string) {
    setDemoProfileCookieClient({
      id: "demo-user-001",
      email: demoEmail,
      full_name: demoName ?? null,
      cpf: null,
      phone: null,
      block: null,
      unit: null,
      role: "morador",
      onboarding_completed: false,
    });
    router.push("/onboarding");
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (mode === "signup" && !hasValidInvite && !isDemo) {
      setErrorMessage(
        "Para criar uma conta de morador, é necessário usar um link de convite enviado pelo síndico.",
      );
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setErrorMessage("Digite um endereço de e-mail válido.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setErrorMessage("As senhas informadas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        startDemoSession(normalizedEmail);
        return;
      }

      if (invitePreview?.valid && invitePreview.token) {
        setInviteTokenCookieClient(invitePreview.token);
      }

      const supabase = createClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          setErrorMessage(translateSupabaseError(error.message));
          return;
        }

        router.push("/");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(translateSupabaseError(error.message));
        return;
      }

      if (!data.session) {
        setInfoMessage(
          "Conta criada! Enviamos um link de confirmação para o seu e-mail. Após confirmar, você concluirá seu cadastro no condomínio.",
        );
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const nextPath =
        invitePreview?.token
          ? `/onboarding?convite=${encodeURIComponent(invitePreview.token)}`
          : "/onboarding";
      router.push(nextPath);
      router.refresh();
    } catch {
      setErrorMessage("Erro inesperado de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setErrorMessage(null);
    setInfoMessage(null);
    setGoogleLoading(true);

    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        startDemoSession("morador.google@vizo.app", "Marina Oliveira");
        return;
      }

      if (invitePreview?.valid && invitePreview.token) {
        setInviteTokenCookieClient(invitePreview.token);
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setErrorMessage(translateSupabaseError(error.message));
        setGoogleLoading(false);
      }
    } catch {
      setErrorMessage("Não foi possível iniciar o login com Google.");
      setGoogleLoading(false);
    }
  }

  const isBusy = loading || googleLoading;
  const signupBlockedWithoutInvite =
    mode === "signup" && !hasValidInvite && !isDemo;

  return (
    <div className="vizo-card rounded-2xl p-6 sm:p-7 animate-vizo-fade">
      {/* Banner de convite válido */}
      {hasValidInvite && invitePreview && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-3 text-xs text-emerald-950">
          <Building2 className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
          <div>
            <p className="font-semibold">
              Convite válido · {invitePreview.condominium_name}
            </p>
            <p className="text-emerald-900/80 mt-0.5">
              Crie sua conta abaixo ou entre com Google para concluir o cadastro
              neste condomínio.
            </p>
          </div>
        </div>
      )}

      {/* Alternador Entrar / Criar conta */}
      <div
        role="tablist"
        aria-label="Modo de acesso"
        className="grid grid-cols-2 rounded-xl bg-slate-100/90 p-1 mb-6"
      >
        <button
          id="tab-login"
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => switchMode("login")}
          className={`rounded-lg py-2 text-sm font-semibold transition-all cursor-pointer ${
            mode === "login"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Entrar
        </button>
        <button
          id="tab-signup"
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => switchMode("signup")}
          className={`rounded-lg py-2 text-sm font-semibold transition-all cursor-pointer ${
            mode === "signup"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Criar conta
        </button>
      </div>

      {/* Aviso discreto quando em Modo Demonstração */}
      {isDemo && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-teal-200/80 bg-teal-50/70 px-3.5 py-3 text-xs leading-relaxed text-teal-900">
          <Info className="h-4 w-4 shrink-0 text-teal-700 mt-0.5" />
          <p>
            <strong className="font-semibold">Modo demonstração ativo:</strong>{" "}
            adicione suas chaves do Supabase em{" "}
            <code className="font-mono text-[11px] bg-white/80 px-1 py-0.5 rounded">
              .env.local
            </code>{" "}
            para autenticação real.
          </p>
        </div>
      )}

      {/* Feedback de erro ou sucesso */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {infoMessage && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Bloqueio de cadastro comum sem convite do síndico */}
      {signupBlockedWithoutInvite ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
              <KeyRound className="h-4 w-4 text-amber-700 shrink-0" />
              <span>Cadastro exclusivo por convite</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-900">
              Para segurança do condomínio, novos moradores precisam de um{" "}
              <strong>link de convite gerado pelo síndico</strong> para criar
              uma conta.
            </p>
          </div>

          <form
            onSubmit={handleRedeemManualInvite}
            className="space-y-3"
            noValidate
          >
            <div>
              <label
                htmlFor="manual-invite-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Recebeu um convite? Cole o link ou código aqui
              </label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="manual-invite-input"
                  type="text"
                  value={manualInviteInput}
                  onChange={(e) => {
                    setManualInviteInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="https://.../convite/... ou código"
                  className="vizo-input pl-11 text-sm"
                />
              </div>
            </div>

            <button type="submit" className="vizo-btn-primary w-full text-sm">
              <span>Validar convite e continuar</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Já possui conta no Vizo?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="font-semibold text-teal-800 hover:underline cursor-pointer"
            >
              Fazer login
            </button>
          </p>
        </div>
      ) : (
        <>
          {/* Botão Google OAuth */}
          <button
            id="btn-google-auth"
            type="button"
            onClick={handleGoogleLogin}
            disabled={isBusy}
            className="vizo-btn-secondary w-full"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
            ) : (
              <GoogleMark />
            )}
            <span>Continuar com Google</span>
          </button>

          {/* Divisor */}
          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-slate-200" />
            <span className="bg-white px-3 text-xs font-medium text-slate-400 shrink-0">
              ou use seu e-mail
            </span>
            <div className="w-full border-t border-slate-200" />
          </div>

          {/* Formulário E-mail/Senha */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="auth-email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@exemplo.com"
                  className="vizo-input pl-11"
                  disabled={isBusy}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "login" ? "Sua senha" : "Mínimo de 6 caracteres"
                  }
                  className="vizo-input pl-11 pr-11"
                  disabled={isBusy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="vizo-input pl-11"
                    disabled={isBusy}
                  />
                </div>
              </div>
            )}

            <button
              id="btn-email-submit"
              type="submit"
              disabled={isBusy}
              className="vizo-btn-primary w-full mt-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {mode === "login" ? "Entrar no Vizo" : "Criar conta no condomínio"}
              </span>
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500 leading-relaxed">
            {hasValidInvite
              ? "No próximo passo você confirmará seus dados pessoais e sua unidade no condomínio."
              : "Acesso exclusivo para síndicos e moradores convidados pelo condomínio."}
          </p>
        </>
      )}
    </div>
  );
}
