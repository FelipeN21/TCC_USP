import express from 'express';
import { listarNotificacoesPorUsuario } from './service.js';
import { iniciarConsumidor } from './consumer.js';
import { metricsMiddleware, metricsHandler } from './metrics.js';

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', sistema: 'B - servico-notificacoes' }));
app.get('/metrics', metricsHandler);

// Rota pública, roteada através do API Gateway.
app.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'requisição deve vir pelo gateway' });
  res.json(await listarNotificacoesPorUsuario(userId));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`servico-notificacoes (Sistema B) ouvindo na porta ${PORT}`));

iniciarConsumidor().catch((err) => {
  console.error('falha fatal ao iniciar consumidor RabbitMQ', err);
  process.exit(1);
});
