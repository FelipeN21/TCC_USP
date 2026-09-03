// Lê os artefatos gerados por run-comparison.ps1 (results/*-k6-summary.json e
// results/*-stats.csv) e consolida em results/comparativo-local.md, no
// formato do Quadro 1 do TCC — porém rotulado como dado de ambiente local
// simulado, para não ser confundido com os dados de produção já reportados
// no TCC original (ver docs/metodologia-local.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const resultsDir = path.join(repoRoot, 'results');

const SISTEMAS = [
  { id: 'a', nome: 'Sistema A — Monólito' },
  { id: 'b', nome: 'Sistema B — Microsserviços' },
  { id: 'c', nome: 'Sistema C — Modular Monolith' }
];
const PERFIS = ['100', '500', '1000'];

function lerResumoK6(sis, perfil) {
  const file = path.join(resultsDir, `${sis}-${perfil}-k6-summary.json`);
  if (!fs.existsSync(file)) return null;
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
  // Formato de exportação do k6: as estatísticas ficam direto no objeto de
  // cada métrica (sem um nível ".values" intermediário). Métricas do tipo
  // "trend" (http_req_duration) expõem avg/min/med/p(90)/p(95)/p(99)/max;
  // "counter" (http_reqs) expõe count/rate; "rate" (http_req_failed) expõe
  // um "value" já normalizado entre 0 e 1.
  const dur = json.metrics?.http_req_duration;
  const reqs = json.metrics?.http_reqs;
  const failed = json.metrics?.http_req_failed;
  if (!dur || !reqs) return null;
  return {
    p50: dur['med'],
    p95: dur['p(95)'],
    p99: dur['p(99)'],
    throughputReqS: reqs['rate'],
    totalReqs: reqs['count'],
    taxaFalha: failed ? failed['value'] * 100 : 0
  };
}

// "123.4MiB" | "1.2GiB" | "512kB" -> MB
function paraMB(texto) {
  const m = texto.trim().match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (!m) return 0;
  const valor = parseFloat(m[1]);
  const unidade = m[2].toLowerCase();
  const fatores = { b: 1 / 1e6, kb: 1e-3, kib: 1 / 1024, mb: 1, mib: 1, gb: 1000, gib: 1024 };
  return valor * (fatores[unidade] ?? 1);
}

function lerStats(sis, perfil) {
  const file = path.join(resultsDir, `${sis}-${perfil}-stats.csv`);
  if (!fs.existsSync(file)) return null;
  const linhas = fs.readFileSync(file, 'utf-8').trim().split('\n').slice(1); // pula header
  if (linhas.length === 0) return null;

  const porTimestamp = new Map();
  for (const linha of linhas) {
    const [timestamp, , cpuStr, memStr] = linha.split(',');
    if (!timestamp || !cpuStr || !memStr) continue;
    const cpu = parseFloat(cpuStr.replace('%', '')) || 0;
    const memUsado = memStr.split('/')[0]?.trim() || '0MB';
    const memMB = paraMB(memUsado);
    const atual = porTimestamp.get(timestamp) || { cpu: 0, mem: 0 };
    atual.cpu += cpu;
    atual.mem += memMB;
    porTimestamp.set(timestamp, atual);
  }

  const grupos = [...porTimestamp.values()];
  if (grupos.length === 0) return null;
  const avgCpu = grupos.reduce((s, g) => s + g.cpu, 0) / grupos.length;
  const avgMem = grupos.reduce((s, g) => s + g.mem, 0) / grupos.length;
  const maxMem = Math.max(...grupos.map((g) => g.mem));
  return { cpuMedioPct: avgCpu, ramMediaMB: avgMem, ramPicoMB: maxMem };
}

function fmt(n, casas = 1) {
  return n === undefined || n === null || Number.isNaN(n) ? '—' : n.toFixed(casas);
}

let md = `# Comparativo local — Sistemas A, B e C\n\n`;
md += `> **Ambiente local simulado.** Estes números vêm de execuções de k6 contra os três\n`;
md += `> sistemas rodando em Docker Compose neste computador (ver \`docs/metodologia-local.md\`).\n`;
md += `> Não substituem os dados de produção já reportados no TCC — servem para validar a\n`;
md += `> proposta do Modular Monolith de forma reproduzível neste ambiente.\n\n`;
md += `Gerado em: ${new Date().toISOString()}\n\n`;

for (const perfil of PERFIS) {
  md += `## Perfil: ${perfil} usuários virtuais simultâneos\n\n`;
  md += `| Métrica | Sistema A (Monólito) | Sistema B (Microsserviços) | Sistema C (Modular Monolith) |\n`;
  md += `|---|---|---|---|\n`;

  const linhas = {
    p50: ['Latência p50 (ms)'],
    p95: ['Latência p95 (ms)'],
    p99: ['Latência p99 (ms)'],
    throughput: ['Throughput (req/s)'],
    falha: ['Taxa de falha (%)'],
    cpu: ['CPU médio agregado (%)'],
    ramMedia: ['RAM média agregada (MB)'],
    ramPico: ['RAM pico agregada (MB)']
  };

  for (const { id } of SISTEMAS) {
    const k6 = lerResumoK6(id, perfil);
    const stats = lerStats(id, perfil);
    linhas.p50.push(fmt(k6?.p50));
    linhas.p95.push(fmt(k6?.p95));
    linhas.p99.push(fmt(k6?.p99));
    linhas.throughput.push(fmt(k6?.throughputReqS));
    linhas.falha.push(fmt(k6?.taxaFalha, 2));
    linhas.cpu.push(fmt(stats?.cpuMedioPct));
    linhas.ramMedia.push(fmt(stats?.ramMediaMB, 0));
    linhas.ramPico.push(fmt(stats?.ramPicoMB, 0));
  }

  for (const linha of Object.values(linhas)) {
    md += `| ${linha.join(' | ')} |\n`;
  }
  md += '\n';
}

md += `---\n\n`;
md += `**Notas:**\n`;
md += `- "CPU médio agregado" e "RAM agregada" somam todos os containers de aplicação do\n`;
md += `  sistema (1 no A e C; gateway + 4 serviços no B) — não incluem banco de dados,\n`;
md += `  RabbitMQ nem os containers de observabilidade, para focar no custo da aplicação.\n`;
md += `- Throughput é a taxa média de requisições/s ao longo de toda a execução do perfil\n`;
md += `  (incluindo rampas de subida/descida), não apenas o platô — método mais simples que\n`;
md += `  o "throughput máximo sustentado" do TCC original, mas consistente entre os 3\n`;
md += `  sistemas.\n`;

const outFile = path.join(resultsDir, 'comparativo-local.md');
fs.writeFileSync(outFile, md, 'utf-8');
console.log(`Relatório gerado em ${outFile}`);
