# Sistema de Filas - Webhook Processing

## Visão Geral

O sistema de filas implementa processamento assíncrono para webhooks, garantindo alta performance e confiabilidade. Utiliza Redis como broker de mensagens e Bull Queue para gerenciamento de jobs.

## Arquitetura

```
Webhook Request → API Handler → Redis Queue → Worker → Database
```

### Componentes

1. **Redis**: Broker de mensagens
2. **Bull Queue**: Gerenciador de filas
3. **Worker**: Processador de jobs
4. **API Handler**: Recebe webhooks e adiciona à fila

## Filas Disponíveis

### 1. Webhook Queue (`webhook-processing`)

- **Propósito**: Processar webhooks recebidos
- **Prioridade**: Alta (1)
- **Retry**: 3 tentativas com backoff exponencial
- **Timeout**: 30 segundos

### 2. Flow Queue (`flow-processing`)

- **Propósito**: Executar fluxos de chatbot
- **Prioridade**: Média (2)
- **Retry**: 3 tentativas
- **Timeout**: 60 segundos

### 3. Notification Queue (`notifications`)

- **Propósito**: Enviar notificações
- **Prioridade**: Baixa (3)
- **Retry**: 2 tentativas
- **Timeout**: 15 segundos

## Configuração

### Variáveis de Ambiente

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional

# Database
DATABASE_URL=postgresql://user:pass@host:port/db
```

### Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
```

## Uso

### 1. Iniciar Worker

```bash
# Desenvolvimento
npm run worker:dev

# Produção
npm run worker

# Docker
docker-compose up worker
```

### 2. Monitorar Filas

```bash
# Estatísticas das filas
GET /api/queue/stats

# Limpar filas antigas
POST /api/queue/clean
```

### 3. Adicionar Job à Fila

```typescript
import { addWebhookJob } from '@/services/queue';

const job = await addWebhookJob({
  webhookId: 'wh_123',
  method: 'POST',
  headers: {},
  queryParams: {},
  body: { data: 'example' },
  timestamp: new Date().toISOString(),
  flowId: 'flow_123',
  nodeId: 'node_123',
  config: {},
});
```

## Monitoramento

### Métricas Disponíveis

- **Waiting**: Jobs aguardando processamento
- **Active**: Jobs sendo processados
- **Completed**: Jobs processados com sucesso
- **Failed**: Jobs que falharam
- **Delayed**: Jobs agendados para o futuro

### API Endpoints

#### GET /api/queue/stats

Retorna estatísticas completas das filas:

```json
{
  "status": "success",
  "data": {
    "queues": {
      "webhook": {
        "waiting": 5,
        "active": 2,
        "completed": 100,
        "failed": 3,
        "activeJobs": [...]
      }
    },
    "summary": {
      "totalWaiting": 5,
      "totalActive": 2,
      "totalCompleted": 100,
      "totalFailed": 3
    }
  }
}
```

#### POST /api/queue/clean

Limpa jobs antigos das filas.

## Processamento de Webhooks

### Fluxo de Processamento

1. **Recebimento**: Webhook chega na API
2. **Validação**: Autenticação e validação básica
3. **Enfileiramento**: Job adicionado à fila
4. **Resposta**: API retorna 200 imediatamente
5. **Processamento**: Worker processa o job
6. **Execução**: Fluxo do chatbot é executado
7. **Finalização**: Status atualizado no banco

### Tipos de Nós Suportados

- **Message**: Envio de mensagens
- **Condition**: Lógica condicional
- **API**: Chamadas para APIs externas
- **Delay**: Atrasos programados
- **Webhook**: Outros webhooks

## Configurações Avançadas

### Retry Policy

```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
}
```

### Rate Limiting

```typescript
// Limitar por webhook
const rateLimit = {
  max: 100,
  window: 60000, // 1 minuto
};
```

### Dead Letter Queue

Jobs que falham após todas as tentativas são movidos para uma fila de "mortos" para análise posterior.

## Troubleshooting

### Problemas Comuns

#### 1. Worker não processa jobs

- Verificar conexão com Redis
- Verificar logs do worker
- Verificar se o worker está rodando

#### 2. Jobs ficam travados

- Verificar timeout das jobs
- Verificar recursos do servidor
- Reiniciar worker

#### 3. Redis desconecta

- Verificar configuração de rede
- Verificar logs do Redis
- Verificar persistência de dados

### Logs Importantes

```bash
# Logs do worker
docker logs worker

# Logs do Redis
docker logs redis

# Logs da aplicação
docker logs app
```

### Comandos Úteis

```bash
# Ver jobs ativos
redis-cli KEYS "*active*"

# Limpar fila específica
redis-cli DEL "bull:webhook-processing:waiting"

# Ver estatísticas
redis-cli INFO memory
```

## Performance

### Benchmarks

- **Throughput**: ~1000 jobs/minuto
- **Latência**: < 100ms para enfileiramento
- **Memória**: ~50MB por worker
- **CPU**: ~10% por worker ativo

### Otimizações

1. **Múltiplos Workers**: Escalar horizontalmente
2. **Redis Cluster**: Para alta disponibilidade
3. **Job Batching**: Processar múltiplos jobs juntos
4. **Connection Pooling**: Reutilizar conexões

## Segurança

### Recomendações

1. **Redis Auth**: Usar senha no Redis
2. **Network Security**: Isolar Redis em rede privada
3. **Job Validation**: Validar dados dos jobs
4. **Rate Limiting**: Limitar requisições por IP
5. **Monitoring**: Monitorar tentativas de acesso

### Configuração Segura

```yaml
# docker-compose.yml
redis:
  environment:
    - REDIS_PASSWORD=strong_password
  command: redis-server --requirepass strong_password
```

## Próximas Funcionalidades

- [ ] Dashboard web para monitoramento
- [ ] Alertas por email/Slack
- [ ] Métricas em tempo real
- [ ] Auto-scaling de workers
- [ ] Job scheduling avançado
- [ ] Dead letter queue UI
- [ ] Performance analytics
