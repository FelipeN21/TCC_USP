import { Router } from 'express';
import { authMiddleware } from '../auth/routes.js';
import { criarPedido, listarPedidos, buscarPedido } from './service.js';

export const pedidosRouter = Router();

pedidosRouter.post('/', authMiddleware, async (req, res) => {
  const { itens } = req.body;
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'itens é obrigatório e deve ser uma lista não vazia' });
  }
  try {
    const pedido = await criarPedido(req.user.id, itens);
    res.status(201).json(pedido);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'erro ao criar pedido' });
  }
});

pedidosRouter.get('/', authMiddleware, async (req, res) => {
  const pedidos = await listarPedidos(req.user.id);
  res.json(pedidos);
});

pedidosRouter.get('/:id', authMiddleware, async (req, res) => {
  const pedido = await buscarPedido(req.params.id, req.user.id);
  if (!pedido) return res.status(404).json({ error: 'pedido não encontrado' });
  res.json(pedido);
});
