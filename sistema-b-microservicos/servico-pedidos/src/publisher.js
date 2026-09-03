import amqp from 'amqplib';

const QUEUE = 'pedido.criado';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

let channelPromise = null;

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

async function getChannel() {
  if (!channelPromise) {
    channelPromise = (async () => {
      const connection = await connectWithRetry();
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      return channel;
    })();
  }
  return channelPromise;
}

// Publica o evento "pedido.criado" — equivalente à "mensageria assíncrona via
// RabbitMQ" descrita no TCC. Não é aguardado pela resposta ao cliente.
export async function publicarPedidoCriado(pedidoId, userId) {
  const channel = await getChannel();
  channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify({ pedidoId, userId })), {
    persistent: true
  });
}
