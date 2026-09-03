// Interno do módulo notificações — NÃO deve ser importado por outros módulos.
import { Router } from 'express';
import { authMiddleware } from '../auth/index.js';
import { listarNotificacoesPorUsuario } from './service.js';

export const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  const notificacoes = await listarNotificacoesPorUsuario(req.user.id);
  res.json(notificacoes);
});
