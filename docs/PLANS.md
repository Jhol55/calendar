# Sistema de Planos e Assinaturas

Este documento descreve o sistema de planos de assinatura integrado com Stripe.

## Visão Geral

O sistema oferece três planos:

- **Starter**: 100MB, 1 instância - R$ 29/mês
- **Business**: 1GB, 5 instâncias - R$ 99/mês
- **Enterprise**: 10GB, ilimitado - R$ 299/mês

Todos os planos incluem trial de 7 dias grátis.

## Configuração do Stripe

### 1. Criar Conta no Stripe

1. Acesse [Stripe Dashboard](https://dashboard.stripe.com)
2. Crie uma conta ou faça login
3. Obtenha suas chaves de API (teste ou produção)

### 2. Configurar Variáveis de Ambiente

Adicione ao seu arquivo `.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Price IDs dos planos (criar no Stripe Dashboard)
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_YEARLY=price_xxx
STRIPE_PRICE_BUSINESS_MONTHLY=price_xxx
STRIPE_PRICE_BUSINESS_YEARLY=price_xxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxx
STRIPE_PRICE_ENTERPRISE_YEARLY=price_xxx
```

### 3. Criar Products e Prices no Stripe

1. No Stripe Dashboard, vá para **Products**
2. Crie 3 produtos:

   - Starter
   - Business
   - Enterprise

3. Para cada produto, crie 2 prices (monthly e yearly)

4. Copie os Price IDs e adicione às variáveis de ambiente acima

### 4. Configurar Webhook

1. No Stripe Dashboard, vá para **Developers > Webhooks**
2. Clique em **Add endpoint**
3. URL: `https://seu-dominio.com/api/stripe/webhook`
4. Selecione eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copie o **Signing secret** e adicione como `STRIPE_WEBHOOK_SECRET`

### 5. Testar Webhook Localmente (Desenvolvimento)

Use o Stripe CLI:

```bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks para localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Isso retornará um webhook secret de teste. Use-o como `STRIPE_WEBHOOK_SECRET` localmente.

## Executar Migration e Seed

```bash
# Criar migration
npx prisma migrate dev --name add_plans_subscription_system

# Executar seed de planos
npx tsx prisma/seeds/plans.seed.ts
```

## Fluxo do Sistema

1. **Registro** → Usuário se cadastra
2. **Confirmação de Email** → Após confirmar, redireciona para `/plans`
3. **Seleção de Plano** → Usuário escolhe plano e inicia checkout
4. **Checkout Stripe** → Redirecionado para Stripe
5. **Webhook** → Stripe notifica quando checkout completa
6. **Trial de 7 dias** → Ativado automaticamente
7. **Renovação** → Cobrança automática após trial

## Validações de Limites

O sistema valida automaticamente:

- **Armazenamento**: Ao criar tabelas e inserir dados
- **Instâncias**: Ao criar novas instâncias WhatsApp

Se o limite for excedido, o usuário recebe erro explicativo sugerindo upgrade.

## Gerenciamento de Assinatura

Usuários podem gerenciar assinatura em `/billing`:

- Ver status atual
- Acessar Stripe Customer Portal
- Visualizar limites do plano

## Estrutura do Banco

- `Plan`: Definição dos planos
- `subscription`: Assinaturas dos usuários
- `user_plan_limits`: Cache de limites e uso atual

## Troubleshooting

### Webhook não funciona

- Verifique `STRIPE_WEBHOOK_SECRET`
- Teste com Stripe CLI localmente
- Verifique logs em `/api/stripe/webhook`

### Checkout não redireciona

- Verifique Price IDs nas variáveis de ambiente
- Confirme que `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` está configurado
- Verifique console do navegador para erros

### Limites não sendo respeitados

- Verifique se usuário tem subscription ativa
- Confirme que `getUserPlan` retorna plano válido
- Verifique logs de validação
