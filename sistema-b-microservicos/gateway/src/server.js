import express from 'express';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { metricsMiddleware, metricsHandler } from './metrics.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-troque-em-producao';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
const PEDIDOS_URL = process.env.PEDIDOS_SERVICE_URL || 'http://pedidos-service:3000';
const FATURAMENTO_URL = process.env.FATURAMENTO_SERVICE_URL || 'http://faturamento-service:3000';
const NOTIFICACOES_URL = process.env.NOTIFICACOES_SERVICE_URL || 'http://notificacoes-service:3000';

const app = express();
app.use(metricsMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', sistema: 'B - gateway' }));
app.get('/metrics', metricsHandler);

// Autenticação centralizada no gateway: valida o JWT uma única vez e repassa
// a identidade do usuário aos serviços internos via headers — os serviços não
// precisam reverificar o token (conforme "API Gateway para roteamento e
// autenticação centralizada" descrito no TCC).
function authGate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'token ausente' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.headers['x-user-id'] = payload.sub;
    req.headers['x-user-email'] = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'token inválido' });
  }
}

// Rotas públicas de autenticação — não passam pelo authGate.
app.use('/auth', createProxyMiddleware({ target: AUTH_URL, changeOrigin: true }));

// Rotas protegidas — roteadas para cada microsserviço após validação do token.
app.use('/pedidos', authGate, createProxyMiddleware({ target: PEDIDOS_URL, changeOrigin: true }));
app.use('/faturas', authGate, createProxyMiddleware({ target: FATURAMENTO_URL, changeOrigin: true }));
app.use('/notificacoes', authGate, createProxyMiddleware({ target: NOTIFICACOES_URL, changeOrigin: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gateway (Sistema B) ouvindo na porta ${PORT}`));
