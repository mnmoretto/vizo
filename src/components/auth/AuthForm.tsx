"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setDemoProfileCookieClient } from "@/lib/demo-session";

interface AuthFormProps {
  isDemo: boolean;
  initialError?: string | null;
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

export function AuthForm({ isDemo, initialError }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError ?? null,
  );
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setInfoMessage(null);
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

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
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

      // Cadastro por e-mail e senha
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

      // Se a confirmação de e-mail estiver ativa no projeto Supabase, session virá null
      if (!data.session) {
        setInfoMessage(
          "Conta criada! Enviamos um link de confirmação para o seu e-mail. Após confirmar, você concluirá seu cadastro de morador.",
        );
        setPassword("");
        setConfirmPassword("");
        return;
      }

      router.push("/onboarding");
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

  return (
    <div className="vizo-card rounded-2xl p-6 sm:p-7 animate-vizo-fade">
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
            para autenticação real. Você já pode testar o fluxo completo abaixo.
          </p>
        </div>
      )}

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
            {mode === "login" ? "Entrar no Vizo" : "Criar conta gratuita"}
          </span>
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-500 leading-relaxed">
        {mode === "signup"
          ? "Novas contas entram inicialmente com perfil de Morador e completam o cadastro da unidade no próximo passo."
          : "Primeiro acesso? Ao entrar com Google ou criar conta, solicitaremos os dados da sua unidade."}
      </p>
    </div>
  );
}
