# Vizo

Web app mobile-first responsivo para registro e acompanhamento de **ocorrências e vistorias internas** em condomínios residenciais.

## Stack

- **Next.js 16** (App Router + TypeScript)
- **Tailwind CSS v4**
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) para Autenticação (E-mail/Senha + Google OAuth), PostgreSQL com RLS e Storage de imagens
- **Lucide React** para iconografia

## O que está pronto

### Etapa 1 — Acesso, Onboarding e Base Responsiva
- Autenticação completa com **E-mail/Senha** (Login e Cadastro) e **Google OAuth** (`/login` e `/auth/callback`)
- **Onboarding obrigatório** (`/onboarding`) bloqueando o acesso ao app até o preenchimento de Nome completo, CPF (com máscara e dígitos verificadores), Telefone/WhatsApp, Bloco/Torre e Apartamento/Casa
- Schema SQL em [`supabase/schema.sql`](./supabase/schema.sql) com flag `role` (`'morador'` por padrão ou `'sindico'`), trigger de criação automática de perfil, políticas RLS e bucket privado `occurrences-media`
- Layout base mobile-first responsivo (top bar + bottom navigation no mobile)

### Etapa 2 — Experiência Completa do Morador
- **Registrar Ocorrido** (`/ocorrencias/nova`): seleção de cômodo, descrição com contador em tempo real e validação mínima de **100 caracteres** (no frontend e no banco), captura direta pela câmera do celular (`capture="environment"`) e upload múltiplo da galeria para o Supabase Storage privado
- **Protocolo e Carimbo Automáticos**: geração automática de código único legível (`VIZ-AAAA-NNNN`) e exibição da data/hora exatas junto aos registros e fotos
- **Listagem e Filtros** (`/`): lista apenas as ocorrências do próprio morador com miniatura da foto, protocolo, cômodo, data/hora e status (`Aberto`, `Resolvido`, `Cancelado`)
- **Detalhes com Linha do Tempo** (`/ocorrencias/[id]`): visualização ampliada (lightbox) das fotos com carimbo, histórico cronológico e adição de novas atualizações (comentários e/ou fotos) enquanto estiver `Aberto` — bloqueado automaticamente quando `Resolvido` ou `Cancelado`
- Migration SQL da Etapa 2 em [`supabase/stage2_occurrences.sql`](./supabase/stage2_occurrences.sql)

### Etapa 3 — Módulo Administrativo do Síndico
- **Painel Geral do Condomínio** (`/` quando `role = 'sindico'`): listagem de todas as ocorrências de todos os moradores exibindo Protocolo, Nome do morador, Bloco/Apartamento, Cômodo, Data/Hora, Status e miniatura
- **Filtros administrativos**: busca por código de protocolo, filtro por Bloco/Torre, filtro por Apartamento/Casa e filtros de Status (`Todos`, `Aberto`, `Resolvido`, `Cancelado`)
- **Ações na tela de detalhes**: identificação completa do morador com atalho de WhatsApp, comentários/fotos intermediários do síndico e **modal de encerramento** (`Resolvido` ou `Cancelado`) exigindo parecer final obrigatório registrado na timeline
- Migration SQL da Etapa 3 em [`supabase/stage3_sindico.sql`](./supabase/stage3_sindico.sql)

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

3. No painel do Supabase:
   - Abra **SQL Editor** e execute em ordem: `supabase/schema.sql`, `supabase/stage2_occurrences.sql` e `supabase/stage3_sindico.sql`.
   - Em **Authentication → URL Configuration**, adicione `http://localhost:3000/auth/callback` (e a URL da Vercel em produção) em *Redirect URLs*.
   - Em **Authentication → Providers → Google**, habilite o provedor Google (Client ID e Client Secret do Google Cloud Console).

4. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse `http://localhost:3000`.
