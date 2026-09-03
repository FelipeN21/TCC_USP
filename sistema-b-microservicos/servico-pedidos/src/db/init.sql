CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  itens JSONB NOT NULL,
  valor_total NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'criado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_user_id ON pedidos(user_id);
