'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TabProps {
  text: string;
  selected: boolean;
  setSelected: (text: string) => void;
  discount?: boolean;
}

export const Tab = ({
  text,
  selected,
  setSelected,
  discount = false,
}: TabProps) => {
  return (
    <button
      onClick={() => setSelected(text)}
      className={cn(
        'relative w-fit px-5 py-2.5 text-sm font-semibold capitalize transition-colors',
        discount && 'flex items-center justify-center gap-2.5',
        selected ? 'text-white' : 'text-neutral-600',
      )}
    >
      <span className="relative z-10">{text}</span>
      {selected && (
        <motion.span
          layoutId="tab"
          transition={{ type: 'spring', duration: 0.4 }}
          className="absolute inset-0 z-0 rounded-md bg-neutral-700"
        />
      )}
      {discount && (
        <span
          className={cn(
            'relative z-10 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold',
            selected
              ? 'bg-white/20 text-white'
              : 'bg-neutral-100 text-neutral-700',
          )}
        >
          Economize 20%
        </span>
      )}
    </button>
  );
};
