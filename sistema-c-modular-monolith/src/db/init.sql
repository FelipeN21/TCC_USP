-- Sistema C - Modular Monolith: um schema PostgreSQL por módulo de domínio,
-- no MESMO banco físico, mas sem foreign keys entre schemas — cada módulo é
-- dono exclusivo dos seus dados, do mesmo jeito que seria se cada um estivesse
-- em um banco de dados separado (facilita extração futura para microsserviço
-- sem refatoração estrutural, conforme discutido no TCC).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS pedidos;
CREATE SCHEMA IF NOT EXISTS faturamento;
CREATE SCHEMA IF NOT EXISTS notificacoes;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedidos.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,          -- referência lógica a auth.users.id (sem FK cross-schema)
  itens JSONB NOT NULL,
  valor_total NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'criado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedidos_user_id ON pedidos.pedidos(user_id);

-- user_id duplicado a partir do pedido (ver nota de design em shared/dominio.md):
-- evita que faturamento/notificações precisem importar o módulo pedidos só
-- para escopar listagens por usuário (o que criaria um import circular).
CREATE TABLE IF NOT EXISTS faturamento.faturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL,        -- referência lógica a pedidos.pedidos.id (sem FK cross-schema)
  user_id UUID NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'emitida',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_faturas_user_id ON faturamento.faturas(user_id);

CREATE TABLE IF NOT EXISTS notificacoes.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL,        -- referência lógica a pedidos.pedidos.id (sem FK cross-schema)
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  canal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id ON notificacoes.notificacoes(user_id);
