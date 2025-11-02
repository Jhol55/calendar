# Estratégia de Sincronização Stripe ↔ Banco de Dados

## Visão Geral

Este documento descreve a estratégia implementada para garantir que as assinaturas do Stripe estejam sempre sincronizadas com o banco de dados PostgreSQL.

## Pontos de Sincronização

### 1. Webhooks em Tempo Real (Principal)

Os webhooks do Stripe são a **fonte de verdade** e mantêm o banco sincronizado em tempo real.

#### Eventos Mapeados:

| Evento                          | Handler                     | Ação                                |
| ------------------------------- | --------------------------- | ----------------------------------- |
| `checkout.session.completed`    | `handleCheckoutCompleted`   | Criar/atualizar assinatura no banco |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Atualizar status, períodos, plano   |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Cancelar assinatura no banco        |
| `invoice.payment_succeeded`     | `handlePaymentSucceeded`    | Manter status ativo                 |
| `invoice.payment_failed`        | `handlePaymentFailed`       | Atualizar para past_due             |

**Arquivos:**

- `src/app/api/stripe/webhook/route.ts` - Endpoint de webhook
- `src/services/stripe/stripe.service.ts` - Handlers de eventos

### 2. Sincronização Reativa (Fallback)

Quando ações são realizadas diretamente no código (não via webhook), a sincronização é imediata:

- **Criar checkout** → `createCheckoutSession` atualiza banco
- **Alterar plano** → `changePlan` atualiza Stripe e banco
- **Cancelar assinatura** → `cancelUserSubscription` atualiza Stripe e banco

**Características:**

- Transações atômicas quando possível
- Updates do Stripe geram webhook subsequente
- Fallback manual em caso de falha no webhook

### 3. Sincronização Automática Periódica

Um **job agendado** roda diariamente às **2:00 AM** para verificar e sincronizar todas as assinaturas automaticamente:

- Verifica status de sincronização (`checkSyncStatus`)
- Se encontrar diferenças, executa `syncAllSubscriptions()` automaticamente
- Roda no **worker** usando `node-cron`
- Funciona como fallback caso webhooks falhem

**Arquivos:**

- `src/workers/helpers/subscription-sync.ts` - Job de sincronização
- `scripts/start-worker.js` - Inicia o job automaticamente

**Logs:**

```
🔄 [Job] Iniciando sincronização automática de assinaturas...
✅ [Job] Todas as assinaturas estão sincronizadas
```

### 4. Sincronização Manual (Admin)

Para reconciliar diferenças ou após outages (backup da automática):

#### Serviços Disponíveis:

**`syncAllSubscriptions()`** - Sincroniza todas as assinaturas

```typescript
import { syncAllSubscriptions } from '@/services/stripe/sync.service';

const result = await syncAllSubscriptions();
// Retorna: { success, processed, errors, details }
```

**`syncSingleSubscription(subscription)`** - Sincroniza uma assinatura específica

```typescript
import { syncSingleSubscription } from '@/services/stripe/sync.service';

await syncSingleSubscription(stripeSubscription);
```

**`checkSyncStatus()`** - Verifica status de sincronização

```typescript
import { checkSyncStatus } from '@/services/stripe/sync.service';

const status = await checkSyncStatus();
// Retorna: { inSync, outOfSync, missing, details }
```

#### Rotas API Admin:

**GET** `/api/admin/sync-subscriptions` - Verificar status

```bash
curl http://localhost:3000/api/admin/sync-subscriptions
```

**POST** `/api/admin/sync-subscriptions` - Executar sincronização

```bash
curl -X POST http://localhost:3000/api/admin/sync-subscriptions
```

**Arquivos:**

- `src/services/stripe/sync.service.ts` - Serviços de sincronização
- `src/app/api/admin/sync-subscriptions/route.ts` - Rotas API

## Garantias de Idempotência

### 1. Upsert Pattern

Uso de `upsert` em webhooks para evitar duplicatas:

```typescript
await prisma.subscription.upsert({
  where: { userId },
  create: {
    /* novo registro */
  },
  update: {
    /* atualizar existente */
  },
});
```

### 2. Validação de Timestamps

Conversão segura de timestamps Unix:

```typescript
const safeUnixToDate = (timestamp: number | null | undefined): Date | null => {
  if (
    timestamp &&
    typeof timestamp === 'number' &&
    !isNaN(timestamp) &&
    timestamp > 0
  ) {
    return new Date(timestamp * 1000);
  }
  return null;
};
```

### 3. Atualização Condicional de Datas

Não sobrescrever datas válidas com `null`:

```typescript
const updateData: any = { status: subscription.status };

// Só adicionar campos de data se não forem null
if (trialEndsAt !== null) updateData.trialEndsAt = trialEndsAt;
if (currentPeriodStart !== null)
  updateData.currentPeriodStart = currentPeriodStart;
if (currentPeriodEnd !== null) updateData.currentPeriodEnd = currentPeriodEnd;
```

## Fluxo de Sincronização

### Cenário 1: Nova Assinatura

```
1. Usuário clica em "Assinar" → createCheckoutSession
2. Usuário conclui pagamento no Stripe
3. Stripe → webhook: checkout.session.completed
4. handleCheckoutCompleted → cria/atualiza no banco
5. ✅ Sincronizado
```

### Cenário 2: Mudança de Plano

```
1. Usuário clica em "Trocar de Plano" → changePlan
2. changePlan → atualiza Stripe via API
3. Stripe → webhook: customer.subscription.updated
4. handleSubscriptionUpdated → atualiza banco
5. ✅ Sincronizado (dupla verificação)
```

### Cenário 3: Webhook Falhou

```
1. Webhook falhou ou não chegou
2. Sincronização manual → syncAllSubscriptions()
3. Busca todas assinaturas no Stripe
4. Compara com banco e atualiza diferenças
5. ✅ Sincronizado
```

### Cenário 4: Assinatura Deletada Manualmente no Stripe

```
1. Assinatura deletada no Stripe Dashboard
2. Webhook: customer.subscription.deleted
3. handleSubscriptionDeleted → cancela no banco
4. Atualiza session → hasPlan = false
5. ✅ Sincronizado
```

## Configuração de Webhooks no Stripe

### Endpoint de Webhook

```
POST https://seu-dominio.com/api/stripe/webhook
```

### Eventos Necessários

1. `checkout.session.completed`
2. `customer.subscription.updated`
3. `customer.subscription.deleted`
4. `invoice.payment_succeeded`
5. `invoice.payment_failed`

### Configuração no Stripe Dashboard

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em "Add endpoint"
3. Cole a URL do webhook
4. Selecione os eventos acima
5. Copie o `Signing secret` → `STRIPE_WEBHOOK_SECRET`

### Teste Local

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# Autenticar
stripe login

# Encaminhar webhooks para localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook

# O terminal mostrará o webhook secret
```

## Monitoramento e Debugging

### Logs Importantes

Os logs são estruturados com emojis para fácil identificação:

- 🎯 Processando webhook
- ✅ Sucesso na operação
- ❌ Erro na operação
- ⚠️ Aviso/potencial problema
- 🔄 Sincronização em andamento
- 📊 Informações de debug

### Comandos Úteis

```bash
# Verificar status de sincronização
curl http://localhost:3000/api/admin/sync-subscriptions

# Executar sincronização manual
curl -X POST http://localhost:3000/api/admin/sync-subscriptions

# Ver logs do servidor
# No terminal onde o app está rodando
```

### Identificando Problemas

1. **Assinatura no Stripe mas não no banco**

   - Verificar webhook `checkout.session.completed`
   - Executar `syncAllSubscriptions()`

2. **Status diferente entre Stripe e banco**

   - Verificar webhook `customer.subscription.updated`
   - Verificar logs de erro
   - Executar `syncAllSubscriptions()`

3. **Plano diferente entre Stripe e banco**
   - Verificar se `STRIPE_PRICE_*` está correto no `.env`
   - Verificar handler `handleSubscriptionUpdated`
   - Executar `syncAllSubscriptions()`

## Boas Práticas

### ✅ Fazer

- Sempre tratar webhooks de forma idempotente
- Retornar 200 mesmo em caso de erro (para evitar retries)
- Logar todos os erros para debug
- Usar `safeUnixToDate` para conversão de timestamps
- Validar dados do Stripe antes de salvar no banco
- Atualizar session JWT após mudanças de plano

### ❌ Evitar

- Não retornar 500 em webhooks (causa retries infinitos)
- Não sobrescrever dados válidos com `null`
- Não fazer queries diretas ao Stripe sem cache quando possível
- Não processar webhooks sem verificar assinatura
- Não confiar apenas no frontend para validações de plano

## Manutenção Regular

### ✅ Automático - Job Diário

A sincronização é **automática** diariamente às 2:00 AM via worker. Não é necessária ação manual.

### Verificação Manual (Opcional)

Execute `checkSyncStatus()` manualmente quando necessário:

```bash
# Verificar status
curl -X GET http://seu-dominio.com/api/admin/sync-subscriptions

# Forçar sincronização imediata
curl -X POST http://seu-dominio.com/api/admin/sync-subscriptions
```

### Alertas Recomendados

- Número de assinaturas dessincronizadas > 0
- Erros em webhooks > 5 em 1 hora
- Taxa de sucesso de webhooks < 99%

## Conclusão

Com essa estratégia em 3 camadas (webhooks em tempo real, sincronização reativa, sincronização manual), garantimos que o banco de dados esteja sempre em sincronia com o Stripe, mesmo em caso de falhas temporárias ou outages.
