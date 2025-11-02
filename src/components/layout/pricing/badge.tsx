import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variant === 'default' &&
          'border-transparent bg-primary text-white shadow',
        variant === 'secondary' && 'border-transparent bg-secondary',
        variant === 'destructive' &&
          'border-transparent bg-red-500 text-white shadow',
        variant === 'outline' && 'border-gray-300',
        className,
      )}
      {...props}
    />
  );
}
