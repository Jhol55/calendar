import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, handleWebhook } from '@/services/stripe/stripe.service';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('❌ Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET is not set');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 },
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('❌ Webhook signature verification failed:', error.message);
      return NextResponse.json(
        { error: `Webhook Error: ${error.message}` },
        { status: 400 },
      );
    }

    // Log do evento recebido
    console.log(`📥 Webhook recebido: ${event.type}`, {
      id: event.id,
      type: event.type,
      created: new Date(event.created * 1000).toISOString(),
    });

    // IMPORTANTE: Retornar 200 imediatamente para eventos conhecidos
    // Isso evita timeouts e permite processar assincronamente se necessário
    // Processar webhook
    try {
      const result = await handleWebhook(event);

      if (!result.success) {
        console.error(`❌ Webhook processing failed:`, {
          eventType: event.type,
          error: result.message,
        });
        // Mesmo em caso de erro, retornar 200 para evitar retries infinitos
        // O Stripe vai tentar novamente depois se necessário
        return NextResponse.json(
          { received: true, error: result.message },
          { status: 200 },
        );
      }

      console.log(`✅ Webhook processado com sucesso: ${event.type}`);
      return NextResponse.json({ received: true, eventType: event.type });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Erro ao processar webhook:`, {
        eventType: event.type,
        error: err.message,
        stack: err.stack,
      });
      // Retornar 200 mesmo em erro para evitar retries infinitos
      // Logar o erro para debug manual
      return NextResponse.json(
        { received: true, error: 'Internal server error (logged)' },
        { status: 200 },
      );
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`❌ Erro crítico no webhook:`, {
      error: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { received: true, error: 'Critical error (logged)' },
      { status: 200 },
    );
  }
}
