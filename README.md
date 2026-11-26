# Vizo

Web app mobile-first responsivo para registro e acompanhamento de **ocorrências e vistorias internas** em condomínios residenciais.

## Stack

- **Next.js 16** (App Router + TypeScript)
- **Tailwind CSS v4**
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) para Autenticação (E-mail/Senha + Google OAuth), PostgreSQL com RLS e Storage de imagens
- **Lucide React** para iconografia

## O que está pronto nesta Etapa 1

- Autenticação completa com **E-mail/Senha** (Login e Cadastro) e **Google OAuth** (`/login` e `/auth/callback`)
- **Onboarding obrigatório** (`/onboarding`) bloqueando o acesso ao app até o preenchimento de:
  - Nome completo
  - CPF (com máscara `000.000.000-00` e validação de dígitos verificadores)
  - Telefone/WhatsApp (com máscara `(00) 00000-0000` / `(00) 0000-0000`)
  - Bloco/Torre (com atalhos rápidos + texto livre)
  - Número do Apartamento/Casa
- Schema SQL em [`supabase/schema.sql`](./supabase/schema.sql) com flag `role` (`'morador'` por padrão ou `'sindico'`), trigger de criação automática de perfil, políticas de Row Level Security (RLS) e bucket `occurrences-media` pronto para a Etapa 2
- Layout base mobile-first responsivo (top bar + bottom navigation no mobile) com tela inicial vazia preparada para listar ocorrências (`/`) e tela de perfil (`/perfil`)

## Como rodar localmente

1. Instale as dependências:

```bash
npm install
```

2. Configure as variáveis de ambiente copiando o modelo:

```bash
cp .env.example .env.local
```

Preencha `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do seu projeto Supabase.

> **Dica:** Se você rodar o app sem preencher `.env.local`, o Vizo ativa automaticamente um **Modo Demonstração** local para testar o fluxo completo (`Login -> Onboarding -> Home`) antes mesmo de conectar o Supabase.

3. No painel do Supabase:
   - Abra **SQL Editor** e execute o conteúdo de `supabase/schema.sql`.
   - Em **Authentication → URL Configuration**, adicione `http://localhost:3000/auth/callback` em *Redirect URLs*.
   - Em **Authentication → Providers → Google**, habilite o provedor Google (Client ID e Client Secret do Google Cloud Console).

4. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse `http://localhost:3000`.
