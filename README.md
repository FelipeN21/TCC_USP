# TCC — Arquiteturas monolíticas e microsserviços

Implementação prática dos três sistemas comparados no TCC *"Arquiteturas
monolíticas e microsserviços: eficiência de recursos, manutenção e
escalabilidade"*: Sistema A (monólito), Sistema B (microsserviços) e Sistema
C (Modular Monolith, proposta do trabalho).

Ver [`docs/metodologia-local.md`](docs/metodologia-local.md) para o escopo e
as adaptações metodológicas desta validação local, e
[`shared/dominio.md`](shared/dominio.md) para o modelo de domínio comum aos
três sistemas.

## Estrutura

```
sistema-a-monolito/          Sistema A — Node.js/Express, PostgreSQL único
sistema-b-microservicos/     Sistema B — gateway + 4 microsserviços, RabbitMQ
sistema-c-modular-monolith/  Sistema C — monólito com módulos isolados, Redis
load-tests/k6/               Cenário de carga (k6), parametrizado por sistema
scripts/                     Orquestração da comparação e geração de relatórios
docs/                        Metodologia e notas para o TCC
shared/                      Modelo de domínio comum
results/                     Saída dos testes de carga (gerado, não versionar)
```

## Pré-requisitos

- Docker Desktop
- Node.js 24+ (para rodar os scripts de análise/relatório fora do Docker)

## Rodando um sistema isoladamente

```bash
cd sistema-a-monolito   # ou sistema-b-microservicos / sistema-c-modular-monolith
docker compose up -d --build
curl http://localhost:3000/health   # 3020 para o Sistema B (gateway)
```

Fluxo de teste manual (mesmo em todos os sistemas — trocar a porta):

```bash
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"teste@exemplo.com","password":"senha123"}'

TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"teste@exemplo.com","password":"senha123"}' | jq -r .token)

curl -X POST http://localhost:3000/pedidos -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"itens":[{"descricao":"Produto X","quantidade":2,"valor_unitario":50}]}'

curl http://localhost:3000/pedidos -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/faturas -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/notificacoes -H "Authorization: Bearer $TOKEN"
```

Derrubar: `docker compose down` (dentro da pasta do sistema).

## Rodando a comparação completa

```powershell
./scripts/run-comparison.ps1        # sobe cada sistema, roda k6 (100/500/1000 VUs), deriva
node scripts/generate-report.js     # -> results/comparativo-local.md
node scripts/madge-report.js        # -> results/madge-report.md (acoplamento A vs C)
```

## Verificar fronteiras de módulo do Sistema C

```bash
cd sistema-c-modular-monolith
npm install
npm run check-boundaries
```

Falha (exit code 1) se algum módulo importar o interno de outro módulo
diretamente, em vez de passar pelo `index.js` público — é a verificação
estática que sustenta a alegação do TCC de "convenção arquitetural
verificada em pipeline".

## Observabilidade

Cada sistema sobe seu próprio Prometheus + Grafana + cAdvisor (portas em
[`docs/metodologia-local.md`](docs/metodologia-local.md)). Grafana está com
acesso anônimo habilitado (role Admin) só para uso local.
