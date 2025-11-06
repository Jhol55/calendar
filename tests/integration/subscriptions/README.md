# Testes de Integração - Assinaturas

## 📋 Visão Geral

Testes abrangentes para garantir que o sistema de assinaturas está 100% confiável.

## 🧪 Testes Disponíveis

### 1. `01.subscription-basic.test.ts`

Testes básicos de assinaturas:

- ✅ Criação e leitura de assinaturas
- ✅ Cálculo de armazenamento
- ✅ Validação de limites
- ✅ Status de assinatura (active, trialing, canceled)

### 2. `02.subscription-operations.test.ts`

Operações avançadas:

- ✅ Mudança de plano (upgrade/downgrade)
- ✅ Mudança de modalidade (mensal/anual)
- ✅ Cancelamento de assinatura
- ✅ Transições de status
- ✅ Planos ilimitados

### 3. `03.storage-calculation.test.ts`

Cálculo de armazenamento:

- ✅ Cálculo básico (DataTables + Memórias)
- ✅ Sistema de cache (Redis + PostgreSQL)
- ✅ Atualização incremental
- ✅ Performance e escalabilidade

### 4. `04.sync-and-webhooks.test.ts`

Sincronização e webhooks:

- ✅ Processamento de webhooks do Stripe (com API real se configurado)
- ✅ Sincronização entre banco e Stripe
- ✅ Idempotência de webhooks
- ✅ Atualização de períodos de cobrança
- 📖 **Nota**: Requer `STRIPE_SECRET_KEY` configurado com chave de teste (`sk_test_...`) para usar API real. Veja `STRIPE_API_SETUP.md` para mais detalhes.

### 5. `05.storage-validation.test.ts`

Validação de armazenamento:

- ✅ Validação de downgrade de plano bloqueando quando limites são excedidos
- ✅ Validação de armazenamento no Database Node
- ✅ Validação de armazenamento no Memory Node
- ✅ Função `canUseStorage` para validar espaço disponível
- ✅ Planos ilimitados

## 🚀 Como Executar

### Executar todos os testes de assinaturas:

```bash
npm run test:node -- tests/integration/subscriptions
```

### Executar teste específico:

```bash
npm run test:node -- tests/integration/subscriptions/__tests__/01.subscription-basic.test.ts
```

### Executar com watch mode:

```bash
npm run test:node:watch -- tests/integration/subscriptions
```

## 📊 Cobertura

### ✅ Funcionalidades Testadas:

1. **Criação de Assinaturas**

   - ✅ Criação de assinatura ativa
   - ✅ Obtenção de plano do usuário
   - ✅ Tratamento de usuário sem assinatura

2. **Cálculo de Armazenamento**

   - ✅ Cálculo com SQL otimizado
   - ✅ Cache hierárquico (Redis → PostgreSQL → SQL)
   - ✅ Atualização incremental
   - ✅ Performance com grandes volumes

3. **Validação de Limites**

   - ✅ Limite de armazenamento
   - ✅ Limite de instâncias
   - ✅ Planos ilimitados
   - ✅ Validação antes de usar recursos

4. **Operações de Assinatura**

   - ✅ Mudança de plano
   - ✅ Mudança de modalidade
   - ✅ Cancelamento (imediato e ao final do período)
   - ✅ Validações de transições

5. **Webhooks e Sincronização**

   - ✅ Processamento de eventos Stripe
   - ✅ Sincronização de dados
   - ✅ Idempotência

6. **Validação de Armazenamento**
   - ✅ Bloqueio de downgrade quando uso excede limites
   - ✅ Validação antes de inserir no Database Node
   - ✅ Validação antes de salvar no Memory Node
   - ✅ Função `canUseStorage` para verificação de espaço

## 🔧 Setup Necessário

### Variáveis de Ambiente:

```bash
DATABASE_URL=postgresql://postgres:123456@localhost:5433/wazzy_test
REDIS_HOST=localhost
REDIS_PORT=6380
NODE_ENV=test
```

### Banco de Dados de Teste:

```bash
npm run test:db:up
npm run test:db:migrate
```

## ⚠️ Notas Importantes

1. **Stripe Mock**: Os testes usam mocks do Stripe. Para testes reais com Stripe, você precisaria de:

   - API keys de teste
   - Webhook signing secret
   - Configuração adicional

2. **Sessão de Usuário**: Alguns testes mockam a sessão do usuário. Testes que usam `changePlan` ou `cancelUserSubscription` precisam de sessão configurada.

3. **Cache Redis**: Os testes limpam o cache Redis antes de cada teste para garantir isolamento.

4. **Dados de Teste**: Cada teste cria e limpa seus próprios dados para garantir isolamento completo.

## 📈 Melhorias Futuras

- [ ] Testes com Stripe Test Mode real
- [ ] Testes de stress com muitos usuários
- [ ] Testes de concorrência
- [ ] Testes de webhooks com signing verification
- [ ] Testes de integração com checkout real
