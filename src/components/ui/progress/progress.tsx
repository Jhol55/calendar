import { cn } from '@/lib/utils';
import { Typography } from '@/components/ui/typography';

interface ProgressProps {
  /**
   * Valor atual (usado)
   */
  current: number;
  /**
   * Valor máximo (limite)
   * Se -1, considera como ilimitado
   */
  max: number;
  /**
   * Label do recurso (ex: "Armazenamento", "Instâncias")
   */
  label: string;
  /**
   * Formato do valor para exibição
   */
  formatValue?: (value: number) => string;
  /**
   * Cor da barra de progresso (opcional)
   */
  color?: 'default' | 'success' | 'warning' | 'danger';
  /**
   * Se é dark mode
   */
  isDark?: boolean;
  /**
   * Classe adicional
   */
  className?: string;
}

export function Progress({
  current,
  max,
  label,
  formatValue,
  color = 'default',
  isDark = false,
  className,
}: ProgressProps) {
  // Se max é -1, considera ilimitado
  const isUnlimited = max === -1;

  // Calcular porcentagem (cap em 100%)
  const percentage = isUnlimited
    ? 0 // 0% se ilimitado, mas mostra o valor atual
    : Math.min(Math.round((current / max) * 100), 100);

  // Formatar valores
  const formatCurrent = formatValue ? formatValue(current) : `${current}`;
  const formatMax = isUnlimited
    ? '∞'
    : formatValue
      ? formatValue(max)
      : `${max}`;

  // Cores baseadas na porcentagem e no modo
  const getColorClasses = () => {
    if (color !== 'default') {
      switch (color) {
        case 'success':
          return {
            bg: 'bg-green-500',
            text: isDark ? 'text-green-300' : 'text-green-600',
          };
        case 'warning':
          return {
            bg: 'bg-yellow-500',
            text: isDark ? 'text-yellow-300' : 'text-yellow-600',
          };
        case 'danger':
          return {
            bg: 'bg-red-500',
            text: isDark ? 'text-red-300' : 'text-red-600',
          };
        default:
          return {
            bg: 'bg-neutral-600',
            text: isDark ? 'text-neutral-300' : 'text-neutral-600',
          };
      }
    }

    // Auto-cores baseadas na porcentagem
    if (percentage >= 90) {
      return {
        bg: 'bg-red-500',
        text: isDark ? 'text-red-300' : 'text-red-600',
      };
    } else if (percentage >= 70) {
      return {
        bg: 'bg-yellow-500',
        text: isDark ? 'text-yellow-300' : 'text-yellow-600',
      };
    } else {
      return {
        bg: 'bg-neutral-600',
        text: isDark ? 'text-neutral-300' : 'text-neutral-600',
      };
    }
  };

  const colorClasses = getColorClasses();
  const trackBg = isDark ? 'bg-neutral-700' : 'bg-neutral-200';

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label e valores */}
      <div className="flex items-center justify-between">
        <Typography
          variant="p"
          className={cn(
            'text-sm font-medium',
            isDark ? 'text-neutral-300' : 'text-neutral-700',
          )}
        >
          {label}
        </Typography>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold', colorClasses.text)}>
            {formatCurrent}
          </span>
          <span
            className={cn(
              'text-sm',
              isDark ? 'text-neutral-400' : 'text-neutral-500',
            )}
          >
            / {formatMax}
          </span>
        </div>
      </div>

      {/* Barra de progresso */}
      {!isUnlimited ? (
        <div
          className={cn(
            'h-5 rounded-full overflow-hidden relative shadow-inner',
            trackBg,
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out flex items-center shadow-sm',
              colorClasses.bg,
            )}
            style={{ width: `${percentage}%` }}
          >
            {/* Porcentagem dentro da barra (sempre que houver espaço) */}
            {percentage >= 18 && (
              <span className="text-sm font-bold text-white opacity-95 ml-2.5 drop-shadow-sm">
                {percentage}%
              </span>
            )}
          </div>
          {/* Porcentagem do lado direito se não cabe dentro */}
          {percentage < 18 && percentage > 0 && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-600 dark:text-neutral-400">
              {percentage}%
            </span>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'h-3.5 rounded-full overflow-hidden shadow-inner',
            trackBg,
          )}
        >
          <div className="h-full flex items-center justify-center">
            <span
              className={cn(
                'text-xs font-medium',
                isDark ? 'text-neutral-400' : 'text-neutral-500',
              )}
            >
              Ilimitado
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
