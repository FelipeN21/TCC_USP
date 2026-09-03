import { Router } from 'express';
import { authMiddleware } from '../auth/routes.js';
import { listarFaturasPorUsuario, buscarFatura } from './service.js';

export const faturamentoRouter = Router();

faturamentoRouter.get('/', authMiddleware, async (req, res) => {
  const faturas = await listarFaturasPorUsuario(req.user.id);
  res.json(faturas);
});

faturamentoRouter.get('/:id', authMiddleware, async (req, res) => {
  const fatura = await buscarFatura(req.params.id, req.user.id);
  if (!fatura) return res.status(404).json({ error: 'fatura não encontrada' });
  res.json(fatura);
});
