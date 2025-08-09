import { cn } from '@/lib/utils';
import { FakeCaretProps } from './fake-caret.type';

export const FakeCaret = ({ isActive, className }: FakeCaretProps) => {
  return (
    <>
      {isActive && (
        <div className="absolute pointer-events-none inset-0 flex items-center justify-center animate-caret-blink">
          <div className={cn('w-px h-6 bg-white', className)} />
        </div>
      )}
    </>
  );
};
