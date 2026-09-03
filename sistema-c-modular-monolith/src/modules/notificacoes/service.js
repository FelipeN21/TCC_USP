// Interno do módulo notificações — NÃO deve ser importado por outros módulos.
import { poolFor } from '../../db/pool.js';

const pool = poolFor('notificacoes');

// Mesmo atraso artificial usado nos Sistemas A e B, para manter a comparação justa.
function delayArtificial() {
  const ms = 20 + Math.random() * 30;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enviarNotificacao(pedidoId, userId, tipo = 'pedido_criado', canal = 'email') {
  await delayArtificial();
  const { rows } = await pool.query(
    'INSERT INTO notificacoes (pedido_id, user_id, tipo, canal) VALUES ($1, $2, $3, $4) RETURNING *',
    [pedidoId, userId, tipo, canal]
  );
  return rows[0];
}

export async function listarNotificacoesPorUsuario(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM notificacoes WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}
