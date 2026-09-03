import { Router } from 'express';
import { authMiddleware } from '../auth/routes.js';
import { listarNotificacoesPorUsuario } from './service.js';

export const notificacoesRouter = Router();

notificacoesRouter.get('/', authMiddleware, async (req, res) => {
  const notificacoes = await listarNotificacoesPorUsuario(req.user.id);
  res.json(notificacoes);
});
