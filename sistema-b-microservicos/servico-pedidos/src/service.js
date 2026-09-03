import axios from 'axios';
import { pool } from './db/pool.js';
import { publicarPedidoCriado } from './publisher.js';

const FATURAMENTO_URL = process.env.FATURAMENTO_SERVICE_URL || 'http://faturamento-service:3000';

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

  // Chamada REST síncrona ao servico-faturamento (rede real dentro do
  // Docker Compose: serialização JSON + TCP + desserialização) — é
  // exatamente o "hop" de rede que o TCC aponta como fonte de latência
  // adicional em relação ao Sistema A/C.
  await axios.post(`${FATURAMENTO_URL}/internal/faturas`, {
    pedidoId: pedido.id,
    userId,
    valor: valorTotal
  });
  await pool.query("UPDATE pedidos SET status = 'faturado' WHERE id = $1", [pedido.id]);

  // Disparo assíncrono via RabbitMQ — não aguardado pela resposta ao cliente.
  publicarPedidoCriado(pedido.id, userId).catch((err) =>
    console.error('falha ao publicar evento pedido.criado', err)
  );

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
