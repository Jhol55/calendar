export const PLANS_CONFIG = {
  TRIAL_DAYS: 7,
} as const;

export const PLAN_FEATURES = {
  starter: ['Suporte por email', 'Até 10 fluxos'],
  business: ['Suporte prioritário', 'Fluxos ilimitados', 'Webhooks ilimitados'],
  enterprise: [
    'Suporte 24/7',
    'Fluxos ilimitados',
    'Webhooks ilimitados',
    'API dedicada',
  ],
  trial: ['Até 5 fluxos', 'Suporte por email', 'Teste por 7 dias'],
} as const;
