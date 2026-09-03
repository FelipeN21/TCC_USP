import { EventEmitter } from 'node:events';

// Equivalente conceitual in-process ao RabbitMQ do Sistema B: pedidos publica
// o evento, notificações assina. A entrega é assíncrona (setImmediate) para não
// bloquear a resposta HTTP ao cliente, mas sem custo de rede/serialização —
// é exatamente a comunicação "in-process" que o TCC contrasta com a "chamada
// de rede" do Sistema B.
class EventBus extends EventEmitter {
  publish(event, payload) {
    setImmediate(() => this.emit(event, payload));
  }
  subscribe(event, handler) {
    this.on(event, (payload) => {
      Promise.resolve(handler(payload)).catch((err) =>
        console.error(`erro ao processar evento "${event}"`, err)
      );
    });
  }
}

export const eventBus = new EventBus();
