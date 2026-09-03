import express from 'express';
import { authRouter } from './modules/auth/routes.js';
import { pedidosRouter } from './modules/pedidos/routes.js';
import { faturamentoRouter } from './modules/faturamento/routes.js';
import { notificacoesRouter } from './modules/notificacoes/routes.js';
import { metricsMiddleware, metricsHandler } from './metrics.js';

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok', sistema: 'A - monolito' }));
app.get('/metrics', metricsHandler);

app.use('/auth', authRouter);
app.use('/pedidos', pedidosRouter);
app.use('/faturas', faturamentoRouter);
app.use('/notificacoes', notificacoesRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sistema A (monolito) ouvindo na porta ${PORT}`));
