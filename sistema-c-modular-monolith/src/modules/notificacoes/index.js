// Interface pública do módulo notificações. É o ÚNICO arquivo que outros
// módulos podem importar — verificado por scripts/check-boundaries.js.
import { eventBus } from '../../shared/event-bus.js';
import { enviarNotificacao } from './service.js';

// Assina o evento publicado pelo módulo pedidos — equivalente in-process ao
// consumer do RabbitMQ no Sistema B, sem acoplamento direto entre módulos:
// notificações não conhece pedidos, apenas reage ao evento "pedido.criado".
eventBus.subscribe('pedido.criado', async ({ pedidoId, userId }) => {
  await enviarNotificacao(pedidoId, userId);
  // Coreografia: avisa pedidos de volta para que ele atualize seu próprio status.
  eventBus.publish('notificacao.enviada', { pedidoId });
});

export { router as notificacoesRouter } from './routes.js';
