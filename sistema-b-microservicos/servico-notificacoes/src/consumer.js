import amqp from 'amqplib';
import { enviarNotificacao } from './service.js';

const QUEUE = 'pedido.criado';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

async function connectWithRetry(retries = 20, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await amqp.connect(RABBITMQ_URL);
    } catch (err) {
      console.log(`RabbitMQ indisponível (tentativa ${i}/${retries}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('não foi possível conectar ao RabbitMQ após várias tentativas');
}

// Consumidor assíncrono da fila publicada pelo servico-pedidos — equivalente
// à "mensageria assíncrona via RabbitMQ" descrita no TCC.
export async function iniciarConsumidor() {
  const connection = await connectWithRetry();
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  channel.prefetch(10);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const { pedidoId, userId } = JSON.parse(msg.content.toString());
      await enviarNotificacao(pedidoId, userId);
      channel.ack(msg);
    } catch (err) {
      console.error('falha ao processar mensagem da fila', err);
      channel.nack(msg, false, false);
    }
  });

  console.log(`servico-notificacoes consumindo fila "${QUEUE}" no RabbitMQ`);
}
