// Interno do módulo faturamento — NÃO deve ser importado por outros módulos.
import { Router } from 'express';
import { authMiddleware } from '../auth/index.js';
import { listarFaturasPorUsuario, buscarFatura } from './service.js';

export const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  const faturas = await listarFaturasPorUsuario(req.user.id);
  res.json(faturas);
});

router.get('/:id', authMiddleware, async (req, res) => {
  const fatura = await buscarFatura(req.params.id, req.user.id);
  if (!fatura) return res.status(404).json({ error: 'fatura não encontrada' });
  res.json(fatura);
});
