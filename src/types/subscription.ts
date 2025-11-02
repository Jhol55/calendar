export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  UNPAID = 'unpaid',
}

export enum BillingPeriod {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export interface Plan {
  id: number;
  name: string;
  slug: string;
  description?: string;
  maxStorageMB: number;
  maxInstances: number; // -1 = ilimitado
  priceMonthly: number;
  priceYearly: number;
  features?: string[];
  isActive: boolean;
}

export interface Subscription {
  id: number;
  userId: number;
  planId: number;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  status: SubscriptionStatus | string;
  billingPeriod: BillingPeriod | string;
  trialEndsAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  canceledAt?: Date;
  cancelAtPeriodEnd: boolean;
  plan?: Plan;
  currentUsage?: {
    storageMB: number;
    instances: number;
  };
}

export interface UserPlanLimits {
  userId: number;
  currentStorageMB: number;
  currentInstances: number;
  updatedAt: Date;
}
