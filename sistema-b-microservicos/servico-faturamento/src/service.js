import { pool } from './db/pool.js';

export async function emitirFatura(pedidoId, userId, valor) {
  const { rows } = await pool.query(
    'INSERT INTO faturas (pedido_id, user_id, valor) VALUES ($1, $2, $3) RETURNING *',
    [pedidoId, userId, valor]
  );
  return rows[0];
}

export async function listarFaturasPorUsuario(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM faturas WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

export async function buscarFatura(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM faturas WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}
