// Interface pública do módulo auth. É o ÚNICO arquivo que outros módulos
// podem importar (import '../auth/index.js') — verificado por
// scripts/check-boundaries.js.
export { router as authRouter, authMiddleware } from './routes.js';
