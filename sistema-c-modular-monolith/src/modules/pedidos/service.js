// Interno do módulo pedidos — NÃO deve ser importado por outros módulos.
import { poolFor } from '../../db/pool.js';
import { emitirFatura } from '../faturamento/index.js'; // chamada síncrona in-process
import { eventBus } from '../../shared/event-bus.js';    // disparo assíncrono
import { getRedis } from '../../cache/redis.js';

const pool = poolFor('pedidos');
const CACHE_TTL_SEGUNDOS = 30;

function calcularValorTotal(itens) {
  return itens.reduce((soma, item) => soma + item.quantidade * item.valor_unitario, 0);
}

async function invalidarCache(userId) {
  try {
    const redis = await getRedis();
    await redis.del(`pedidos:${userId}`);
  } catch (err) {
    console.error('falha ao invalidar cache de pedidos', err);
  }
}

export async function criarPedido(userId, itens) {
  const valorTotal = calcularValorTotal(itens);

  const { rows } = await pool.query(
    'INSERT INTO pedidos (user_id, itens, valor_total) VALUES ($1, $2, $3) RETURNING *',
    [userId, JSON.stringify(itens), valorTotal]
  );
  const pedido = rows[0];

  // Chamada síncrona in-process ao módulo faturamento — equivalente conceitual
  // ao REST síncrono do Sistema B, mas sem serialização/rede.
  await emitirFatura(pedido.id, userId, valorTotal);
  await pool.query("UPDATE pedidos SET status = 'faturado' WHERE id = $1", [pedido.id]);

  // Disparo assíncrono via event bus in-process — equivalente conceitual ao
  // evento publicado no RabbitMQ do Sistema B. Não é aguardado pela resposta;
  // o status final ("notificado") é atualizado quando o módulo notificações
  // publica de volta o evento "notificacao.enviada" (ver assinatura abaixo).
  eventBus.publish('pedido.criado', { pedidoId: pedido.id, userId });

  await invalidarCache(userId);

  pedido.status = 'faturado';
  return pedido;
}

export async function listarPedidos(userId) {
  const cacheKey = `pedidos:${userId}`;
  try {
    const redis = await getRedis();
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.error('falha ao ler cache de pedidos', err);
  }

  const { rows } = await pool.query(
    'SELECT * FROM pedidos WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );

  try {
    const redis = await getRedis();
    await redis.set(cacheKey, JSON.stringify(rows), { EX: CACHE_TTL_SEGUNDOS });
  } catch (err) {
    console.error('falha ao gravar cache de pedidos', err);
  }

  return rows;
}

export async function buscarPedido(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM pedidos WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}

// Fecha o ciclo assíncrono: quando notificações termina de enviar, avisa de
// volta via evento (coreografia), e pedidos atualiza seu próprio status —
// cada módulo só escreve no seu próprio schema.
eventBus.subscribe('notificacao.enviada', async ({ pedidoId }) => {
  await pool.query("UPDATE pedidos SET status = 'notificado' WHERE id = $1", [pedidoId]);
});
