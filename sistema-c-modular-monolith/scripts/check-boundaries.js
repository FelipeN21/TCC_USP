// Verifica, via análise estática (Madge), que nenhum arquivo interno de um
// módulo importa diretamente o interno de outro módulo — só é permitido
// importar o index.js público (modules/<nome>/index.js). É a verificação em
// pipeline que o TCC descreve como "convenção arquitetural verificada em
// pipeline" (proibição de acesso direto entre módulos).
import madge from 'madge';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

function moduleOf(relPath) {
  const parts = relPath.split(path.sep).join('/').split('/');
  if (parts[0] === 'modules' && parts.length > 1) return parts[1];
  return null; // fora de modules/* (shared/, db/, cache/, server.js) — sem restrição
}

const result = await madge(srcRoot, { fileExtensions: ['js'] });
const graph = result.obj();

const violations = [];
for (const [file, deps] of Object.entries(graph)) {
  const fromModule = moduleOf(file);
  if (!fromModule) continue;
  for (const dep of deps) {
    const toModule = moduleOf(dep);
    if (toModule && toModule !== fromModule && path.basename(dep) !== 'index.js') {
      violations.push(`${file}  →  ${dep}   (deveria importar apenas modules/${toModule}/index.js)`);
    }
  }
}

if (violations.length > 0) {
  console.error(`❌ ${violations.length} violação(ões) de fronteira entre módulos:\n`);
  violations.forEach((v) => console.error('  - ' + v));
  process.exit(1);
}

console.log(`✅ Nenhuma violação de fronteira entre módulos (${Object.keys(graph).length} arquivos analisados em src/).`);
