import { pool } from '../../db/pool.js';
import { emitirFatura } from '../faturamento/service.js';
import { enviarNotificacao } from '../notificacoes/service.js';

function calcularValorTotal(itens) {
  return itens.reduce((soma, item) => soma + item.quantidade * item.valor_unitario, 0);
}

export async function criarPedido(userId, itens) {
  const valorTotal = calcularValorTotal(itens);

  const { rows } = await pool.query(
    'INSERT INTO pedidos (user_id, itens, valor_total) VALUES ($1, $2, $3) RETURNING *',
    [userId, JSON.stringify(itens), valorTotal]
  );
  const pedido = rows[0];

  // Chamada síncrona in-process para faturamento (equivalente ao REST síncrono do Sistema B)
  await emitirFatura(pedido.id, userId, valorTotal);
  await pool.query("UPDATE pedidos SET status = 'faturado' WHERE id = $1", [pedido.id]);

  // Disparo assíncrono para notificações (equivalente ao evento RabbitMQ do Sistema B):
  // não é aguardado pela resposta ao cliente, apenas registrado para completar em background.
  enviarNotificacao(pedido.id, userId)
    .then(() => pool.query("UPDATE pedidos SET status = 'notificado' WHERE id = $1", [pedido.id]))
    .catch((err) => console.error('falha ao enviar notificação', err));

  pedido.status = 'faturado';
  return pedido;
}

export async function listarPedidos(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM pedidos WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

export async function buscarPedido(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM pedidos WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}
