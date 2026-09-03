// Roda Madge sobre o Sistema A e o Sistema C e conta dependências cruzadas
// entre módulos (arquivo em modules/X importando arquivo em modules/Y),
// reproduzindo a métrica de manutenibilidade do Quadro 3 do TCC ("dependências
// cruzadas entre módulos identificadas por análise estática").
//
// Requer que `npm install` já tenha sido rodado em sistema-c-modular-monolith
// (usa a instância local de madge desse pacote). Sistema A não depende de
// madge — é analisado usando a mesma instância.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const require = createRequire(
  path.join(repoRoot, 'sistema-c-modular-monolith', 'package.json')
);
const madgePath = require.resolve('madge', {
  paths: [path.join(repoRoot, 'sistema-c-modular-monolith')]
});
const { default: madge } = await import(pathToFileURL(madgePath).href);

function moduleOf(relPath) {
  const parts = relPath.split(path.sep).join('/').split('/');
  if (parts[0] === 'modules' && parts.length > 1) return parts[1];
  return null;
}

async function analisar(nome, srcDir) {
  const result = await madge(srcDir, { fileExtensions: ['js'] });
  const graph = result.obj();

  let cruzadas = 0;
  const detalhes = [];
  for (const [file, deps] of Object.entries(graph)) {
    const fromModule = moduleOf(file);
    if (!fromModule) continue;
    for (const dep of deps) {
      const toModule = moduleOf(dep);
      if (toModule && toModule !== fromModule) {
        cruzadas++;
        detalhes.push(`${file} -> ${dep}`);
      }
    }
  }

  return {
    nome,
    arquivosAnalisados: Object.keys(graph).length,
    dependenciasCruzadas: cruzadas,
    detalhes
  };
}

const resultadoA = await analisar(
  'Sistema A (monólito)',
  path.join(repoRoot, 'sistema-a-monolito', 'src')
);
const resultadoC = await analisar(
  'Sistema C (Modular Monolith)',
  path.join(repoRoot, 'sistema-c-modular-monolith', 'src')
);

let md = `# Análise de acoplamento (Madge) — Sistema A vs Sistema C\n\n`;
md += `Gerado em: ${new Date().toISOString()}\n\n`;
md += `| Sistema | Arquivos analisados | Dependências cruzadas entre módulos |\n`;
md += `|---|---|---|\n`;
md += `| ${resultadoA.nome} | ${resultadoA.arquivosAnalisados} | ${resultadoA.dependenciasCruzadas} |\n`;
md += `| ${resultadoC.nome} | ${resultadoC.arquivosAnalisados} | ${resultadoC.dependenciasCruzadas} |\n\n`;

md += `No Sistema C, toda dependência cruzada listada abaixo aponta necessariamente para\n`;
md += `um arquivo \`index.js\` (interface pública do módulo) — é o que \`scripts/check-boundaries.js\`\n`;
md += `verifica. No Sistema A não há essa restrição: qualquer arquivo pode importar\n`;
md += `diretamente o interno de outro módulo.\n\n`;

md += `## Detalhe — Sistema A\n\n`;
md += resultadoA.detalhes.length
  ? resultadoA.detalhes.map((d) => `- ${d}`).join('\n')
  : '_nenhuma dependência cruzada encontrada_';
md += `\n\n## Detalhe — Sistema C\n\n`;
md += resultadoC.detalhes.length
  ? resultadoC.detalhes.map((d) => `- ${d}`).join('\n')
  : '_nenhuma dependência cruzada encontrada_';
md += '\n';

const outFile = path.join(repoRoot, 'results', 'madge-report.md');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, md, 'utf-8');
console.log(md);
console.log(`\nRelatório salvo em ${outFile}`);
