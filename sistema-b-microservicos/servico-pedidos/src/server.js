import express from 'express';
import { criarPedido, listarPedidos, buscarPedido } from './service.js';
import { metricsMiddleware, metricsHandler } from './metrics.js';

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', sistema: 'B - servico-pedidos' }));
app.get('/metrics', metricsHandler);

// Todas as rotas abaixo são roteadas através do API Gateway, que já validou o
// JWT e injetou x-user-id — o serviço confia nesse header (autenticação
// centralizada no gateway).
function exigirUsuario(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'requisição deve vir pelo gateway' });
  req.userId = userId;
  next();
}

app.post('/', exigirUsuario, async (req, res) => {
  const { itens } = req.body;
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'itens é obrigatório e deve ser uma lista não vazia' });
  }
  try {
    const pedido = await criarPedido(req.userId, itens);
    res.status(201).json(pedido);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'erro ao criar pedido' });
  }
});

app.get('/', exigirUsuario, async (req, res) => {
  res.json(await listarPedidos(req.userId));
});

app.get('/:id', exigirUsuario, async (req, res) => {
  const pedido = await buscarPedido(req.params.id, req.userId);
  if (!pedido) return res.status(404).json({ error: 'pedido não encontrado' });
  res.json(pedido);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`servico-pedidos (Sistema B) ouvindo na porta ${PORT}`));
