# ⚠️ SEGURANÇA - Testes com API Real do Stripe

## 🚨 REGRAS CRÍTICAS

### ❌ NUNCA FAÇA:

- **NUNCA** use `stripe.paymentMethods.create()` com números de cartão
- **NUNCA** envie objetos com `card: { number, exp_month, exp_year, cvc }`
- **NUNCA** armazene ou registre números de cartão em logs
- **NUNCA** passe números de cartão em qualquer chamada à API do Stripe

### ✅ SEMPRE USE:

- ✅ **Trial periods** (`trial_period_days`) para criar subscriptions sem payment method
- ✅ **collection_method: 'send_invoice'** para evitar necessidade de payment method imediato
- ✅ **Checkout Sessions** quando precisar de pagamento (processados pelo Stripe)
- ✅ **Setup Intents** apenas para criar payment methods sem números de cartão

## 🔒 Por que isso é importante?

O Stripe **monitora e bloqueia** tentativas de enviar números de cartão diretamente pela API. Isso é:

- **Inseguro**: Viola PCI DSS compliance
- **Bloqueado**: Stripe detecta e envia alertas
- **Desnecessário**: Use trial periods ou Checkout Sessions

## 📋 Abordagem Atual

Nossos testes usam:

1. **Subscriptions com trial**: `trial_period_days: 7`
2. **Collection method**: `collection_method: 'send_invoice'`
3. **Metadata de teste**: `metadata: { test: 'true' }`

Isso permite criar subscriptions reais no Stripe Test Mode **sem** enviar números de cartão.

## 🛡️ Verificação

Para garantir que não há números de cartão no código:

```bash
# Buscar por números de cartão
grep -r "4242\|paymentMethods\.create\|card.*number" tests/

# Buscar por objetos card
grep -r "card:\s*{" tests/
```

## 📝 Nota Importante

Se o Stripe enviou um alerta sobre uso de números de cartão:

1. ✅ **Já corrigido**: O código atual não envia números de cartão
2. ✅ **Verificado**: Todos os testes usam apenas trial periods
3. ✅ **Protegido**: Comentários de segurança adicionados

## 🔍 Monitoramento

O Stripe pode ter detectado uma tentativa anterior durante desenvolvimento.
Isso é normal e esperado - o código foi corrigido para evitar isso.
