// Cenário de carga único, reutilizado para os 3 sistemas (A, B, C) — mesma
// sequência de chamadas, mesmo payload, mesma distribuição de peso entre
// endpoints, para que a comparação entre arquiteturas seja justa.
//
// Fluxo por iteração: cria pedido (dispara faturamento síncrono + notificação
// assíncrona — o "fluxo encadeado" citado no TCC) e lista pedidos. É o mesmo
// fluxo usado no smoke test manual dos 3 sistemas.
//
// Variáveis de ambiente:
//   BASE_URL  - obrigatório. Ex.: http://app:3000 (A/C) ou http://gateway:3000 (B)
//   PROFILE   - "100" | "500" | "1000" (padrão: 100) - perfis de VUs do TCC
//   POOL_SIZE - quantos usuários de teste criar no setup (padrão: 20)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
const PROFILE = __ENV.PROFILE || '100';
const POOL_SIZE = Number(__ENV.POOL_SIZE || 20);

if (!BASE_URL) {
  throw new Error('defina BASE_URL, ex.: -e BASE_URL=http://app:3000');
}

const PERFIS = {
  '100': [
    { duration: '20s', target: 100 },
    { duration: '60s', target: 100 },
    { duration: '10s', target: 0 }
  ],
  '500': [
    { duration: '40s', target: 500 },
    { duration: '60s', target: 500 },
    { duration: '15s', target: 0 }
  ],
  '1000': [
    { duration: '60s', target: 1000 },
    { duration: '60s', target: 1000 },
    { duration: '20s', target: 0 }
  ]
};

export const pedidoCriacaoMs = new Trend('pedido_criacao_ms');
export const listarPedidosMs = new Trend('listar_pedidos_ms');

export const options = {
  scenarios: {
    carga: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: PERFIS[PROFILE]
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.05']
  },
  // inclui p99 no resumo exportado, para reproduzir o formato p50/p95/p99 do
  // Quadro 1 do TCC ("med" do k6 equivale ao p50)
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)']
};

function headersJson(token) {
  return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
}

export function setup() {
  const tokens = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const email = `k6-user-${i}-${Date.now()}@teste.com`;
    const password = 'senha123';
    http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    const token = JSON.parse(loginRes.body).token;
    if (!token) throw new Error(`falha ao autenticar usuário de teste ${i}: ${loginRes.status} ${loginRes.body}`);
    tokens.push(token);
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[__VU % data.tokens.length];

  // POST /pedidos concentra ~60% do peso do cenário, refletindo a
  // justificativa do TCC de que o domínio de pedidos concentra a maior
  // parte do volume de requisições em produção.
  const payload = JSON.stringify({
    itens: [
      { descricao: 'Produto k6', quantidade: 1 + Math.floor(Math.random() * 3), valor_unitario: 25.5 }
    ]
  });
  const criar = http.post(`${BASE_URL}/pedidos`, payload, headersJson(token));
  pedidoCriacaoMs.add(criar.timings.duration);
  check(criar, { 'pedido criado (201)': (r) => r.status === 201 });

  const listar = http.get(`${BASE_URL}/pedidos`, headersJson(token));
  listarPedidosMs.add(listar.timings.duration);
  check(listar, { 'listar pedidos (200)': (r) => r.status === 200 });

  sleep(1);
}
