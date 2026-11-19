import * as React from 'react';
import { Lock, Cloud } from 'lucide-react';
import { EngineKind } from '@/features/registry/types';
import { cn } from '@/lib/utils';

export interface PrivacyLineProps {
  engine: EngineKind;
  className?: string;
}

export const PrivacyLine: React.FC<PrivacyLineProps> = ({
  engine,
  className,
}) => {
  const isBrowser = engine === 'browser';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs text-muted-foreground',
        className
      )}
    >
      {isBrowser ? (
        <Lock className="h-3.5 w-3.5 text-primary shrink-0 stroke-[1.75]" />
      ) : (
        <Cloud className="h-3.5 w-3.5 text-muted-foreground shrink-0 stroke-[1.75]" />
      )}
      <span>
        {isBrowser
          ? 'Everything happens in your browser. Your files never leave your device.'
          : 'Processed on the server and deleted right after conversion.'}
      </span>
    </div>
  );
};
