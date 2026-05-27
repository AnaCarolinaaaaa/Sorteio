# 🚀 Guia de Configuração — Sistema de Sorteio

## Passo 1 — Criar conta no Supabase (gratuito)

1. Acesse [https://supabase.com](https://supabase.com) e crie uma conta
2. Clique em **"New Project"**
3. Dê um nome ao projeto (ex: `sorteio`) e defina uma senha para o banco
4. Aguarde o projeto ser criado (~2 minutos)

---

## Passo 2 — Criar as tabelas no banco de dados

1. No painel do Supabase, clique em **"SQL Editor"** no menu lateral
2. Clique em **"New Query"**
3. Copie e cole o conteúdo do arquivo `supabase/schema.sql` que está na raiz do projeto
4. Clique em **"Run"** (▶️)

Isso criará:
- Tabela `raffles` (sorteios)
- Tabela `tickets` (bilhetes)
- Bucket `comprovantes` no Storage
- Políticas de segurança (RLS)

---

## Passo 3 — Criar o bucket de Storage para comprovantes

1. No painel do Supabase, clique em **"Storage"** no menu lateral
2. Clique em **"New Bucket"**
3. Nome: `comprovantes`
4. Desmarque "Public bucket" (deve ser **privado**)
5. Clique em **"Create bucket"**

---

## Passo 4 — Obter as credenciais do projeto

1. No painel do Supabase, clique em **"Settings"** → **"API"**
2. Copie:
   - **Project URL** (ex: `https://abcdef.supabase.co`)
   - **anon public** key

---

## Passo 5 — Configurar as variáveis de ambiente

Abra o arquivo `.env.local` na pasta `sorteio-app` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_KEY_AQUI
ADMIN_PASSWORD=admin123
```

> ⚠️ Troque `admin123` pela senha que você quiser usar no painel administrativo.

---

## Passo 6 — Rodar o sistema

```bash
cd sorteio-app
npm run dev
```

Acesse: **http://localhost:3000**

---

## 🗂️ Estrutura das páginas

| URL | O que faz |
|---|---|
| `http://localhost:3000` | Página pública do sorteio (grade de bilhetes, prêmio, resultado) |
| `http://localhost:3000/admin` | Login do administrador |
| `http://localhost:3000/admin/dashboard` | Dashboard com estatísticas e botão de sortear |
| `http://localhost:3000/admin/sorteios/novo` | Criar novo sorteio |
| `http://localhost:3000/admin/bilhetes/registrar` | Registrar bilhete vendido |
| `http://localhost:3000/admin/bilhetes` | Lista de todos os bilhetes |

---

## 🔑 Senha padrão do admin

A senha padrão é `admin123`. Para alterar, edite o arquivo `.env.local` (variável `ADMIN_PASSWORD`) e também o arquivo `app/admin/page.tsx` na linha onde compara a senha.

> Para produção, recomenda-se usar o **Supabase Auth** com email/senha em vez da senha simples.

---

## ☁️ Deploy na Vercel (opcional)

1. Crie conta em [https://vercel.com](https://vercel.com)
2. Conecte seu repositório GitHub
3. Configure as variáveis de ambiente nas configurações do projeto na Vercel
4. Deploy automático!
