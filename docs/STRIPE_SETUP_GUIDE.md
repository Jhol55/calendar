# 🎯 Guia Completo: Criar Planos no Stripe

Este guia explica passo a passo como criar os planos no Stripe Dashboard para que o sistema funcione.

## 📋 O que você precisa criar

Você precisa criar **3 Products** (Produtos) no Stripe, cada um com **2 Prices** (Mensal e Anual):

1. **Starter** - Mensal (R$ 29) e Anual
2. **Business** - Mensal (R$ 99) e Anual
3. **Enterprise** - Mensal (Preço customizado) e Anual

---

## 🚀 Passo a Passo Detalhado

### **1. Acesse o Stripe Dashboard**

- Acesse: https://dashboard.stripe.com/test/products
- Certifique-se de estar no modo **Test** (ou **Live** para produção)

### **2. Criar o Produto "Starter"**

#### 2.1 Criar o Product

1. Clique em **"+ Add product"** (Adicionar produto)
2. Preencha:
   - **Name**: `Starter`
   - **Description**: `Perfeito para começar`
3. Clique em **"Save product"**

#### 2.2 Criar Price Mensal

1. No produto criado, clique em **"Add another price"**
2. Preencha:
   - **Price**: `29.00`
   - **Currency**: `BRL` (Real Brasileiro)
   - **Billing period**: `Monthly` (Mensal)
   - **Recurring**: Deixe marcado
3. Clique em **"Save price"**
4. **Copie o Price ID** (começa com `price_`) - você vai precisar!

#### 2.3 Criar Price Anual

1. No mesmo produto, clique em **"Add another price"**
2. Preencha:
   - **Price**: `290.00` (R$ 29 x 10 meses = desconto anual)
   - **Currency**: `BRL`
   - **Billing period**: `Yearly` (Anual)
   - **Recurring**: Deixe marcado
3. Clique em **"Save price"**
4. **Copie o Price ID** (começa com `price_`)

---

### **3. Criar o Produto "Business"**

#### 3.1 Criar o Product

1. Clique em **"+ Add product"**
2. Preencha:
   - **Name**: `Business`
   - **Description**: `Para empresas em crescimento`
3. Clique em **"Save product"**

#### 3.2 Criar Price Mensal

1. Clique em **"Add another price"**
2. Preencha:
   - **Price**: `99.00`
   - **Currency**: `BRL`
   - **Billing period**: `Monthly`
3. Clique em **"Save price"**
4. **Copie o Price ID**

#### 3.3 Criar Price Anual

1. Clique em **"Add another price"**
2. Preencha:
   - **Price**: `990.00` (ou o valor anual desejado)
   - **Currency**: `BRL`
   - **Billing period**: `Yearly`
3. Clique em **"Save price"**
4. **Copie o Price ID**

---

### **4. Criar o Produto "Enterprise"**

#### 4.1 Criar o Product

1. Clique em **"+ Add product"**
2. Preencha:
   - **Name**: `Enterprise`
   - **Description**: `Soluções corporativas completas`
3. Clique em **"Save product"**

#### 4.2 Criar Price Mensal

1. Clique em **"Add another price"**
2. Preencha:
   - **Price**: `0.00` (ou o valor mínimo, pois será customizado)
   - **Currency**: `BRL`
   - **Billing period**: `Monthly`
3. Clique em **"Save price"**
4. **Copie o Price ID**

#### 4.3 Criar Price Anual

1. Clique em **"Add another price"**
2. Preencha:
   - **Price**: `0.00` (ou o valor mínimo)
   - **Currency**: `BRL`
   - **Billing period**: `Yearly`
3. Clique em **"Save price"**
4. **Copie o Price ID**

---

## 🔑 Configurar Variáveis de Ambiente

Após criar todos os Prices e copiar os IDs, adicione no seu arquivo `.env`:

```env
# Stripe Price IDs
STRIPE_PRICE_STARTER_MONTHLY=price_1234567890abcdef
STRIPE_PRICE_STARTER_YEARLY=price_abcdef1234567890
STRIPE_PRICE_BUSINESS_MONTHLY=price_9876543210fedcba
STRIPE_PRICE_BUSINESS_YEARLY=price_fedcba0987654321
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_1111222233334444
STRIPE_PRICE_ENTERPRISE_YEARLY=price_4444333322221111
```

⚠️ **IMPORTANTE**: Substitua os valores `price_...` pelos IDs reais que você copiou do Stripe!

---

## 📸 Como encontrar o Price ID

1. No Stripe Dashboard, vá em **Products**
2. Clique no produto desejado
3. Você verá uma lista de **Prices**
4. O **Price ID** aparece abaixo de cada price (ex: `price_1ABC123xyz...`)
5. Clique no ícone de **copiar** ao lado do ID

---

## ✅ Verificação

Após configurar tudo:

1. ✅ Todos os 3 Products criados
2. ✅ Cada Product com 2 Prices (Monthly e Yearly)
3. ✅ Todos os Price IDs copiados
4. ✅ Variáveis de ambiente configuradas no `.env`

---

## 🧪 Testar

Use os cartões de teste do Stripe:

- **Sucesso**: `4242 4242 4242 4242`
- **Requer autenticação**: `4000 0027 6000 3184`
- **Falha**: `4000 0000 0000 0002`

Expiração: qualquer data futura (ex: `12/25`)  
CVC: qualquer 3 dígitos (ex: `123`)

---

## 📝 Resumo Visual

```
Stripe Dashboard
├── Products
│   ├── Starter
│   │   ├── Price Mensal (R$ 29) → price_XXXXX → STRIPE_PRICE_STARTER_MONTHLY
│   │   └── Price Anual (R$ 290) → price_YYYYY → STRIPE_PRICE_STARTER_YEARLY
│   ├── Business
│   │   ├── Price Mensal (R$ 99) → price_ZZZZZ → STRIPE_PRICE_BUSINESS_MONTHLY
│   │   └── Price Anual (R$ 990) → price_AAAAA → STRIPE_PRICE_BUSINESS_YEARLY
│   └── Enterprise
│       ├── Price Mensal (R$ 0) → price_BBBBB → STRIPE_PRICE_ENTERPRISE_MONTHLY
│       └── Price Anual (R$ 0) → price_CCCCC → STRIPE_PRICE_ENTERPRISE_YEARLY
```

---

## ❓ Problemas Comuns

**Problema**: "Price not configured"  
**Solução**: Verifique se todas as variáveis `STRIPE_PRICE_*` estão no `.env`

**Problema**: Price ID não funciona  
**Solução**: Certifique-se de copiar o ID completo (começa com `price_`)

**Problema**: Teste funciona mas produção não  
**Solução**: Você precisa criar os Products/Prices no modo **Live** também

---

## 🔄 Modo Test vs Live

- **Test mode**: Use durante desenvolvimento (`sk_test_...`)
- **Live mode**: Use em produção (`sk_live_...`)

Você precisa criar os Products/Prices em ambos os modos se quiser testar e ter produção funcionando!
