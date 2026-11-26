"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(
          updateError.message ||
            "Não foi possível redefinir a senha. Solicite um novo link.",
        );
        return;
      }

      setDone(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    } catch {
      setError("Erro inesperado ao salvar a nova senha.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="vizo-card rounded-2xl p-6 sm:p-7 text-center space-y-4 animate-vizo-fade">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900">
            Senha atualizada com sucesso!
          </h1>
          <p className="text-sm text-slate-500">
            Redirecionando você para o Vizo...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="vizo-card rounded-2xl p-6 sm:p-7 space-y-5 animate-vizo-fade">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Criar nova senha
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Escolha uma nova senha segura com pelo menos 6 caracteres.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-medium text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="reset-new-password"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Nova senha
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="reset-new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              className="vizo-input pl-11 pr-11"
              disabled={saving}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="reset-confirm-password"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Confirmar nova senha
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="reset-confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="vizo-input pl-11"
              disabled={saving}
            />
          </div>
        </div>

        <button
          id="btn-save-new-password"
          type="submit"
          disabled={saving}
          className="vizo-btn-primary w-full"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>Salvar nova senha</span>
        </button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Voltar para o login
          </Link>
        </div>
      </form>
    </div>
  );
}
