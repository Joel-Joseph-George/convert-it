import * as React from 'react';
import { EngineKind } from '@/features/registry/types';
import { cn } from '@/lib/utils';

export interface EngineBadgeProps {
  engine: EngineKind;
  badge?: 'best-effort';
  className?: string;
}

export const EngineBadge: React.FC<EngineBadgeProps> = ({
  engine,
  badge,
  className,
}) => {
  const isBrowser = engine === 'browser';

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isBrowser ? 'bg-success' : 'bg-muted-foreground'
          )}
        />
        <span>{isBrowser ? 'In your browser' : 'Server'}</span>
      </span>

      {badge === 'best-effort' && (
        <span className="rounded-chip border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Best effort
        </span>
      )}
    </div>
  );
};
