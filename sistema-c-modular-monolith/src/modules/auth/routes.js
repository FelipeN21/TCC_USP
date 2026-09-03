// Interno do módulo auth — NÃO deve ser importado por outros módulos.
import { Router } from 'express';
import { registrar, autenticar, verificarToken } from './service.js';

export const router = Router();

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  try {
    const user = await registrar(email, password);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'email já cadastrado' });
    res.status(500).json({ error: 'erro interno' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  const token = await autenticar(email, password);
  if (!token) return res.status(401).json({ error: 'credenciais inválidas' });
  res.json({ token });
});

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'token ausente' });
  const payload = verificarToken(token);
  if (!payload) return res.status(401).json({ error: 'token inválido' });
  req.user = { id: payload.sub, email: payload.email };
  next();
}
