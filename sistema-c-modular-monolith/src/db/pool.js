import pg from 'pg';

const { Pool } = pg;
const pools = {};

// Cada módulo obtém um pool com search_path fixado no seu próprio schema —
// não consegue enxergar tabelas de outro módulo por nome não qualificado.
// O isolamento "de verdade" é garantido por convenção de código (só se importa
// o index.js público de outro módulo) e verificado em pipeline por
// scripts/check-boundaries.js, exatamente como descrito no TCC.
//
// max: 10 por schema (40 no total, entre os 4 pools) — testado empiricamente
// contra max: 20 (80 no total) sob o perfil de 1000 VUs: subir o limite
// PIOROU o resultado (RAM pico 1469MB -> 2372MB, p99 5,7s -> 13,6s), porque,
// diferente do Sistema B (cada serviço com seu próprio processo PostgreSQL),
// aqui os 4 pools (um por schema) competem pela MESMA instância física de
// Postgres. Mais conexões simultâneas nesse cenário só aumenta a contenção
// dentro do banco (CPU, locks), sem ganho real de paralelismo — um trade-off
// real do "schema por módulo, banco físico único" da proposta do Modular
// Monolith sob concorrência extrema, distinto do Sistema B (bancos físicos
// independentes, onde subir o pool de cada serviço não gera essa contenção
// cruzada). Ver docs/metodologia-local.md.
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
