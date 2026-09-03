import pg from 'pg';

const { Pool } = pg;
const pools = {};

// Cada módulo obtém um pool com search_path fixado no seu próprio schema —
// não consegue enxergar tabelas de outro módulo por nome não qualificado.
// O isolamento "de verdade" é garantido por convenção de código (só se importa
// o index.js público de outro módulo) e verificado em pipeline por
// scripts/check-boundaries.js, exatamente como descrito no TCC.
export function poolFor(schema) {
  if (!pools[schema]) {
    pools[schema] = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
      max: 10,
      idleTimeoutMillis: 30000
    });
  }
  return pools[schema];
}
