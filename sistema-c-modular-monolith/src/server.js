import express from 'express';
import { authRouter } from './modules/auth/index.js';
import { pedidosRouter } from './modules/pedidos/index.js';
import { faturamentoRouter } from './modules/faturamento/index.js';
import { notificacoesRouter } from './modules/notificacoes/index.js';
import { metricsMiddleware, metricsHandler } from './metrics.js';

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', sistema: 'C - modular monolith' }));
app.get('/metrics', metricsHandler);

app.use('/auth', authRouter);
app.use('/pedidos', pedidosRouter);
app.use('/faturas', faturamentoRouter);
app.use('/notificacoes', notificacoesRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sistema C (modular monolith) ouvindo na porta ${PORT}`));
