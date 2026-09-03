import express from 'express';
import { emitirFatura, listarFaturasPorUsuario, buscarFatura } from './service.js';
import { metricsMiddleware, metricsHandler } from './metrics.js';

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', sistema: 'B - servico-faturamento' }));
app.get('/metrics', metricsHandler);

// Chamada interna síncrona, feita diretamente pelo servico-pedidos (sem
// passar pelo gateway) — equivalente ao "REST síncrono para operações
// transacionais" descrito no TCC.
app.post('/internal/faturas', async (req, res) => {
  const { pedidoId, userId, valor } = req.body;
  if (!pedidoId || !userId || valor === undefined) {
    return res.status(400).json({ error: 'pedidoId, userId e valor são obrigatórios' });
  }
  const fatura = await emitirFatura(pedidoId, userId, valor);
  res.status(201).json(fatura);
});

// Rotas públicas, roteadas através do API Gateway, que injeta x-user-id após
// validar o JWT.
app.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'requisição deve vir pelo gateway' });
  res.json(await listarFaturasPorUsuario(userId));
});

app.get('/:id', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'requisição deve vir pelo gateway' });
  const fatura = await buscarFatura(req.params.id, userId);
  if (!fatura) return res.status(404).json({ error: 'fatura não encontrada' });
  res.json(fatura);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`servico-faturamento (Sistema B) ouvindo na porta ${PORT}`));
