# Modelo de domínio comum

Este modelo é implementado de forma idêntica (mesmas colunas, mesmas regras) nos três
sistemas (A, B, C) para que a comparação de métricas seja justa — nenhuma arquitetura
recebe uma vantagem de domínio "mais leve" ou "mais pesado" que as outras.

## Entidades

### users (módulo/serviço: autenticação)
| coluna | tipo | descrição |
|---|---|---|
| id | uuid pk | |
| email | text unique | |
| password_hash | text | bcrypt |
| created_at | timestamptz | |

### pedidos (módulo/serviço: pedidos)
| coluna | tipo | descrição |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | dono do pedido |
| itens | jsonb | lista `[{descricao, quantidade, valor_unitario}]` |
| valor_total | numeric(12,2) | calculado a partir de `itens` |
| status | text | `criado` \| `faturado` \| `notificado` |
| created_at | timestamptz | |

### faturas (módulo/serviço: faturamento)
| coluna | tipo | descrição |
|---|---|---|
| id | uuid pk | |
| pedido_id | uuid | |
| user_id | uuid | copiado do pedido no momento da criação (ver nota abaixo) |
| valor | numeric(12,2) | |
| status | text | `emitida` |
| created_at | timestamptz | |

### notificacoes (módulo/serviço: notificações)
| coluna | tipo | descrição |
|---|---|---|
| id | uuid pk | |
| pedido_id | uuid | |
| user_id | uuid | copiado do pedido no momento da criação (ver nota abaixo) |
| tipo | text | `pedido_criado` |
| canal | text | `email` (simulado) |
| status | text | `enviada` |
| created_at | timestamptz | |

> **Nota de design — por que `user_id` é duplicado:** cada módulo/serviço é dono
> exclusivo dos seus dados e não deve consultar o módulo/serviço de pedidos só
> para descobrir "quais pedidos são deste usuário" antes de listar faturas ou
> notificações. `user_id` é passado como parte da chamada síncrona
> (faturamento) e do payload do evento assíncrono (notificações) no momento da
> criação do pedido, e cada tabela guarda sua própria cópia. Isso evita
> acoplamento de consulta entre módulos/serviços — no Sistema B evita uma
> chamada REST extra a cada listagem; no Sistema C evita um import circular
> entre os módulos `pedidos` e `faturamento`/`notificacoes`. É o mesmo
> trade-off (denormalização para evitar acoplamento de leitura) usado em
> arquiteturas orientadas a eventos reais.

## Endpoints (mesma superfície nos 3 sistemas)

No Sistema A e C expostos por um único processo. No Sistema B, expostos via API
Gateway, que roteia para o serviço correspondente.

- `POST /auth/register` `{email, password}` → 201 `{id, email}`
- `POST /auth/login` `{email, password}` → 200 `{token}` (JWT, expira em 1h)
- `POST /pedidos` (auth obrigatório) `{itens: [...]}` → 201 `{pedido}`
  - fluxo: cria o pedido → chama faturamento **de forma síncrona** para emitir a
    fatura → publica evento para notificações **de forma assíncrona** → responde ao
    cliente assim que o pedido + fatura existem (não espera a notificação)
  - este é o "fluxo que encadeia mais de um serviço" citado no TCC (pág. 9) usado
    para observar acúmulo de latência entre chamadas
- `GET /pedidos` (auth obrigatório) → lista pedidos do usuário autenticado
- `GET /pedidos/:id` (auth obrigatório)
- `GET /faturas` (auth obrigatório) → lista faturas dos pedidos do usuário
- `GET /faturas/:id`
- `GET /notificacoes` (auth obrigatório) → lista notificações dos pedidos do usuário
- `GET /health` → `{status: "ok"}` (sem auth, usado por healthcheck do Docker Compose)
- `GET /metrics` → métricas Prometheus (`prom-client`, sem auth)

## Regras de negócio (idênticas nos 3 sistemas)

1. `valor_total` do pedido = soma de `quantidade * valor_unitario` de cada item.
2. Faturamento sempre gera fatura no valor total do pedido, sem impostos/descontos
   (fora de escopo — o objetivo é gerar carga de CPU/DB comparável, não regras
   fiscais reais).
3. Notificação é "enviada" após um atraso artificial de 20–50ms (aleatório) para
   simular custo de I/O de um provedor de e-mail/push, igual nos 3 sistemas.
4. Toda rota protegida exige header `Authorization: Bearer <token>`; token inválido
   ou ausente → 401.

## Stack comum

- Node.js 24, Express
- `pg` (driver direto, sem ORM) — evita que overhead de ORM distorça a comparação
  de CPU/RAM entre arquiteturas
- `jsonwebtoken` + `bcrypt`
- `prom-client` — histogram de latência HTTP (`http_request_duration_ms`) com
  buckets finos o suficiente para permitir p50/p95/p99 via `histogram_quantile` no
  Prometheus, exposto em `/metrics`
- `uuid` para geração de IDs
