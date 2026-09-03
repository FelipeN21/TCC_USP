import express from 'express';
import { registrar, autenticar } from './service.js';
import { metricsMiddleware, metricsHandler } from './metrics.js';

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', sistema: 'B - servico-autenticacao' }));
app.get('/metrics', metricsHandler);

app.post('/register', async (req, res) => {
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

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
  const token = await autenticar(email, password);
  if (!token) return res.status(401).json({ error: 'credenciais inválidas' });
  res.json({ token });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`servico-autenticacao (Sistema B) ouvindo na porta ${PORT}`));
