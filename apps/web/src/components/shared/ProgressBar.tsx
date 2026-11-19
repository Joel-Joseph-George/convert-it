import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  progress: number; // 0..100
  className?: string;
  isComplete?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className,
  isComplete,
}) => {
  const clamped = Math.min(100, Math.max(0, progress));
  const done = isComplete || clamped >= 100;

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-border', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-200 ease-linear',
          done ? 'bg-success' : 'bg-primary'
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};
