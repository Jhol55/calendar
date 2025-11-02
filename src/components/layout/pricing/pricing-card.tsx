'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import { Check, ArrowRight } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { Plan } from '@/types/subscription';

interface PricingCardProps {
  plan: Plan;
  paymentFrequency: string;
  features: string[];
  isPopular?: boolean;
  isTrial?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  isLoading?: boolean;
}

export const PricingCard = ({
  plan,
  paymentFrequency,
  features,
  isPopular = false,
  isTrial = false,
  disabled = false,
  onSelect,
  isLoading = false,
}: PricingCardProps) => {
  const price =
    paymentFrequency === 'monthly'
      ? Number(plan.priceMonthly)
      : Number(plan.priceYearly);

  const isHighlighted = plan.slug === 'enterprise';
  const isCustomPrice = plan.slug === 'enterprise';
  const isFree = isTrial || price === 0;

  return (
    <div
      style={{ zoom: 0.9 }}
      className={cn(
        'relative flex flex-col gap-6 overflow-hidden rounded-2xl border p-8 transition-all duration-200',
        isHighlighted
          ? 'bg-neutral-800 border-neutral-800 text-white shadow-xl'
          : 'bg-white border-neutral-200 shadow-md',
        isPopular && !isHighlighted && 'ring-2 ring-neutral-600 ring-offset-2',
      )}
    >
      {/* Card Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Typography
            variant="h2"
            className={cn(
              'capitalize',
              isHighlighted ? 'text-white' : 'text-neutral-900',
            )}
          >
            {plan.name}
          </Typography>
          {isPopular && !isHighlighted && (
            <Badge
              variant="default"
              className="bg-neutral-900 text-white hover:bg-neutral-900"
            >
              Mais Popular
            </Badge>
          )}
        </div>
        <Typography
          variant="p"
          className={cn(
            isHighlighted ? 'text-neutral-300' : 'text-neutral-600',
          )}
        >
          {plan.description}
        </Typography>
      </div>

      {/* Price Section */}
      <div className="relative">
        {isFree ? (
          <div className="space-y-1">
            <Typography
              variant="h2"
              className={cn(
                'text-4xl',
                isHighlighted ? 'text-white' : 'text-neutral-900',
              )}
            >
              Grátis
            </Typography>
            <Typography
              variant="p"
              className={cn(
                isHighlighted ? 'text-neutral-400' : 'text-neutral-500',
              )}
            >
              Por 7 dias
            </Typography>
          </div>
        ) : !isCustomPrice ? (
          <div className="space-y-1">
            <NumberFlow
              format={{
                style: 'currency',
                currency: 'BRL',
                trailingZeroDisplay: 'stripIfInteger',
              }}
              value={price}
              className={cn(
                'text-4xl font-bold',
                isHighlighted ? 'text-white' : 'text-neutral-900',
              )}
            />
            <Typography
              variant="p"
              className={cn(
                isHighlighted ? 'text-neutral-400' : 'text-neutral-500',
              )}
            >
              Por {paymentFrequency === 'monthly' ? 'mês' : 'ano'}
            </Typography>
          </div>
        ) : (
          <Typography
            variant="h2"
            className={cn(
              'text-4xl',
              isHighlighted ? 'text-white' : 'text-neutral-900',
            )}
          >
            Personalizado
          </Typography>
        )}
      </div>

      {/* Features */}
      <div className="flex-1 space-y-3 py-4">
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li
              key={index}
              className={cn(
                'flex items-center gap-3 text-sm font-medium',
                isHighlighted ? 'text-neutral-300' : 'text-neutral-700',
              )}
            >
              <Check
                strokeWidth={2}
                size={18}
                className="flex-shrink-0 text-green-500"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Call to Action Button */}
      <Button
        onClick={onSelect}
        disabled={isLoading || disabled}
        variant="gradient"
        darkenFactor={isHighlighted ? 0.1 : 0.22}
        bgHexColor={isHighlighted ? '#ffffff' : '#545556'}
        className={cn(
          'group',
          isHighlighted
            ? 'text-neutral-900 hover:bg-neutral-100'
            : 'text-white',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        type="button"
      >
        <span className="flex items-center justify-center gap-2 w-full">
          {isLoading ? (
            'Processando...'
          ) : isTrial ? (
            <>
              Começar Teste Grátis
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </>
          ) : isCustomPrice ? (
            'Contatar Vendas'
          ) : (
            <>
              Assinar Agora
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </>
          )}
        </span>
      </Button>
    </div>
  );
};
