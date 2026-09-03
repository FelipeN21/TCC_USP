import { pool } from '../../db/pool.js';

// Simula custo de I/O de um provedor de e-mail/push (20-50ms), igual nos 3 sistemas.
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
