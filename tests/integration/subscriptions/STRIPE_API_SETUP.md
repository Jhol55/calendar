# Configuração de Testes com API Real do Stripe

Os testes de integração para assinaturas podem usar a **API real do Stripe em modo de teste** para garantir máxima confiabilidade.

## 📋 Pré-requisitos

1. **Conta no Stripe** (pode ser conta de teste)
2. **Chave de API de teste** (`sk_test_...`)
3. **Variável de ambiente configurada**

## 🔧 Configuração

### 1. Obter Chave de Teste do Stripe

1. Acesse [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Certifique-se de estar no modo **Test Mode** (toggle no canto superior direito)
3. Copie sua **Secret key** (começa com `sk_test_...`)

### 2. Configurar Variável de Ambiente

Adicione ao seu arquivo `.env` ou `.env.test`:

```env
STRIPE_SECRET_KEY=sk_test_sua_chave_aqui
```

**⚠️ IMPORTANTE**: Use apenas chaves que começam com `sk_test_`. Nunca use chaves de produção (`sk_live_`) nos testes!

### 3. Verificar Configuração

Os testes verificam automaticamente se o Stripe está configurado:

- ✅ Se `STRIPE_SECRET_KEY` estiver configurado e for uma chave de teste → testes rodam com API real
- ⚠️ Se não estiver configurado → testes são pulados com aviso

## 🧪 Como os Testes Funcionam

### O que os testes fazem:

1. **Criam recursos reais no Stripe**:

   - Customers (clientes)
   - Products (produtos)
   - Prices (preços)
   - Subscriptions (assinaturas)
   - Checkout Sessions (sessões de checkout)

2. **Simulam webhooks reais**:

   - Criam eventos do Stripe baseados em recursos reais
   - Processam através de `handleWebhook`
   - Verificam sincronização com o banco local

3. **Limpeza automática**:
   - Todos os recursos criados são deletados após os testes
   - Customers são removidos (isso também remove subscriptions)

### Segurança

- ✅ Apenas chaves de teste são aceitas
- ✅ Todos os recursos são marcados com `metadata.test = 'true'`
- ✅ Limpeza automática de recursos após os testes
- ✅ Isolamento entre testes

## 📊 Testes Disponíveis

### 1. Webhook: Checkout Completo

- Cria checkout session real no Stripe
- Simula webhook `checkout.session.completed`
- Verifica criação de subscription no banco

### 2. Webhook: Atualização de Assinatura

- Cria subscription real no Stripe
- Testa `customer.subscription.updated`
- Testa cancelamento de subscription

### 3. Sincronização

- Verifica sincronização entre Stripe e banco local
- Compara status, IDs e dados

### 4. Idempotência

- Testa processamento de webhook duplicado
- Verifica que não há efeitos colaterais

## 🚀 Executar Testes

```bash
# Com API real do Stripe (se configurado)
npm run test:node -- tests/integration/subscriptions/__tests__/04.sync-and-webhooks.test.ts

# Sem API real (testes serão pulados)
# Remove STRIPE_SECRET_KEY ou configure com chave inválida
```

## ⚠️ Limitações

- **Rate Limits**: O Stripe tem rate limits mesmo em modo de teste
- **Tempo**: Testes com API real são mais lentos (~2-5s por teste)
- **Dependência Externa**: Requer conexão com internet

## 🔍 Debugging

Se os testes falharem:

1. **Verifique a chave**:

   ```bash
   echo $STRIPE_SECRET_KEY
   # Deve começar com sk_test_
   ```

2. **Verifique conexão**:

   ```bash
   curl https://api.stripe.com/v1/charges \
     -u sk_test_YOUR_KEY:
   ```

3. **Veja logs**: Os testes mostram avisos se Stripe não estiver configurado

## 💡 Dica

Para desenvolvimento local, você pode:

- Usar mocks quando quiser testes rápidos
- Usar API real quando precisar validar integração completa
- Configurar ambos e deixar os testes decidirem automaticamente
