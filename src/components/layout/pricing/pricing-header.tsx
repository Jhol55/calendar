'use client';

import { Tab } from './tab';
import { Typography } from '@/components/ui/typography';
import { ReactNode } from 'react';

interface PricingHeaderProps {
  title: string;
  subtitle: string;
  frequencies: string[];
  selectedFrequency: string;
  onFrequencyChange: (frequency: string) => void;
  leftButton?: ReactNode;
  rightButton?: ReactNode;
}

export const PricingHeader = ({
  title,
  subtitle,
  frequencies,
  selectedFrequency,
  onFrequencyChange,
  leftButton,
  rightButton,
}: PricingHeaderProps) => (
  <div className="space-y-7 text-center w-full max-w-7xl" style={{ zoom: 0.9 }}>
    <div className="space-y-4 w-full">
      <div className="relative flex items-center justify-between w-full mx-auto">
        <div className="absolute left-0 top-0">{leftButton}</div>
        <Typography
          variant="h1"
          className="text-4xl md:text-5xl w-full text-center text-neutral-800 whitespace-nowrap"
        >
          {title}
        </Typography>
        <div className="absolute right-0 top-0">{rightButton || <div />}</div>
      </div>
      <Typography variant="p" className="text-lg text-neutral-600">
        {subtitle}
      </Typography>
    </div>
    <div className="mx-auto flex w-fit rounded-lg bg-white border border-neutral-200 p-1.5 shadow-sm">
      {frequencies.map((freq) => (
        <Tab
          key={freq}
          text={freq === 'monthly' ? 'Mensal' : 'Anual'}
          selected={selectedFrequency === freq}
          setSelected={() => onFrequencyChange(freq)}
          discount={freq === 'yearly'}
        />
      ))}
    </div>
  </div>
);
