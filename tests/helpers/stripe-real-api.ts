// ============================================
// HELPER FUNCTIONS PARA TESTES COM API REAL DO STRIPE
// ============================================
//
// ⚠️ SEGURANÇA: Este arquivo NUNCA envia números de cartão de crédito
// para a API do Stripe. Todos os testes usam apenas:
// - Trial periods (períodos de teste)
// - collection_method: 'send_invoice' (sem payment method imediato)
// - Checkout Sessions (processados pelo Stripe)
//
// NUNCA use paymentMethods.create() com números de cartão!
//
// ============================================

import Stripe from 'stripe';

/**
 * Verifica se a API do Stripe está configurada para testes
 */
export function isStripeConfigured(): boolean {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return false;
  }

  // Verifica se é uma chave de teste (começa com sk_test_)
  return secretKey.startsWith('sk_test_');
}

/**
 * Cria instância do Stripe para testes (apenas se configurado)
 */
export function getStripeTestClient(): Stripe | null {
  if (!isStripeConfigured()) {
    return null;
  }

  const STRIPE_API_VERSION = '2024-12-18.acacia' as Stripe.LatestApiVersion;
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
}

/**
 * Cria um customer real no Stripe Test Mode
 */
export async function createStripeTestCustomer(
  email: string,
  name?: string,
): Promise<Stripe.Customer | null> {
  const stripe = getStripeTestClient();
  if (!stripe) {
    throw new Error(
      'Stripe não está configurado. Configure STRIPE_SECRET_KEY com uma chave de teste (sk_test_...)',
    );
  }

  try {
    const customer = await stripe.customers.create({
      email,
      name: name || `Test User ${Date.now()}`,
      metadata: {
        test: 'true',
        testTimestamp: Date.now().toString(),
      },
    });

    return customer;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao criar customer no Stripe:', message);
    throw error;
  }
}

/**
 * Cria um produto e price no Stripe Test Mode para testes
 */
export async function createStripeTestPrice(
  productName: string,
  amount: number,
  currency: string = 'brl',
  interval: 'month' | 'year' = 'month',
): Promise<{ productId: string; priceId: string } | null> {
  const stripe = getStripeTestClient();
  if (!stripe) {
    throw new Error(
      'Stripe não está configurado. Configure STRIPE_SECRET_KEY com uma chave de teste (sk_test_...)',
    );
  }

  try {
    // Criar produto
    const product = await stripe.products.create({
      name: `Test ${productName} - ${Date.now()}`,
      metadata: {
        test: 'true',
      },
    });

    // Criar price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100), // Converter para centavos
      currency: currency.toLowerCase(),
      recurring: {
        interval,
      },
      metadata: {
        test: 'true',
      },
    });

    return {
      productId: product.id,
      priceId: price.id,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao criar produto/price no Stripe:', message);
    throw error;
  }
}

/**
 * Cria uma subscription real no Stripe Test Mode
 *
 * ⚠️ IMPORTANTE: Esta função NUNCA envia números de cartão para a API do Stripe.
 * Usa apenas trial periods e collection_method: 'send_invoice' para evitar
 * a necessidade de payment methods.
 */
export async function createStripeTestSubscription(
  customerId: string,
  priceId: string,
  trialDays?: number,
): Promise<Stripe.Subscription | null> {
  const stripe = getStripeTestClient();
  if (!stripe) {
    throw new Error(
      'Stripe não está configurado. Configure STRIPE_SECRET_KEY com uma chave de teste (sk_test_...)',
    );
  }

  try {
    // Para testes, vamos criar subscription com trial period
    // Isso permite criar subscription sem payment method imediato
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      metadata: {
        test: 'true',
        testTimestamp: Date.now().toString(),
      },
      // Usar trial period para evitar necessidade de payment method imediato
      trial_period_days: trialDays || 7,
      // Definir collection method como send_invoice para não exigir payment method
      collection_method: 'send_invoice',
      days_until_due: 30,
    };

    const subscription = await stripe.subscriptions.create(subscriptionData);

    return subscription;
  } catch {
    // Se falhar por falta de payment method, tentar sem collection_method
    // e com trial apenas
    try {
      const subscriptionDataRetry: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          test: 'true',
          testTimestamp: Date.now().toString(),
        },
        trial_period_days: trialDays || 7,
      };

      const subscription = await stripe.subscriptions.create(
        subscriptionDataRetry,
      );
      return subscription;
    } catch (retryError: unknown) {
      const retryMessage =
        retryError instanceof Error ? retryError.message : 'Erro desconhecido';
      console.error('Erro ao criar subscription no Stripe:', retryMessage);
      throw retryError;
    }
  }
}

/**
 * Cancela uma subscription no Stripe
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = false,
): Promise<Stripe.Subscription | null> {
  const stripe = getStripeTestClient();
  if (!stripe) {
    return null;
  }

  try {
    if (cancelAtPeriodEnd) {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      return await stripe.subscriptions.cancel(subscriptionId);
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao cancelar subscription no Stripe:', message);
    throw error;
  }
}

/**
 * Deleta um customer do Stripe (limpa recursos de teste)
 */
export async function deleteStripeCustomer(
  customerId: string,
): Promise<boolean> {
  const stripe = getStripeTestClient();
  if (!stripe) {
    return false;
  }

  try {
    await stripe.customers.del(customerId);
    return true;
  } catch (error: unknown) {
    // Ignorar erro se customer já foi deletado
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'resource_missing'
    ) {
      return true;
    }
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao deletar customer no Stripe:', message);
    return false;
  }
}

/**
 * Limpa todos os recursos de teste do Stripe criados durante os testes
 * Busca por customers com metadata.test = 'true'
 */
export async function cleanupStripeTestResources(): Promise<void> {
  const stripe = getStripeTestClient();
  if (!stripe) {
    return;
  }

  try {
    // Listar customers de teste
    // Nota: Stripe não suporta filtrar por metadata na listagem
    // Vamos listar todos e filtrar localmente
    const customers = await stripe.customers.list({
      limit: 100,
    });

    // Filtrar apenas customers de teste (com metadata.test = 'true')
    const testCustomers = customers.data.filter(
      (customer) => customer.metadata?.test === 'true',
    );

    // Deletar cada customer de teste (isso também deleta suas subscriptions)
    for (const customer of testCustomers) {
      try {
        await stripe.customers.del(customer.id);
      } catch {
        // Ignorar erros individuais
      }
    }

    console.log(
      `🧹 Limpou ${testCustomers.length} customers de teste do Stripe`,
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido';
    console.warn('Aviso ao limpar recursos do Stripe:', message);
  }
}
