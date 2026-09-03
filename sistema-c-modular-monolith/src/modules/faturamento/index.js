// Interface pública do módulo faturamento. É o ÚNICO arquivo que outros
// módulos podem importar — verificado por scripts/check-boundaries.js.
export { router as faturamentoRouter } from './routes.js';
export { emitirFatura } from './service.js';
