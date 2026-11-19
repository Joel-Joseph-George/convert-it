import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormatPillsProps {
  outputs: { value: string; label: string }[];
  selectedFormat: string;
  onSelectFormat: (format: string) => void;
  className?: string;
  label?: string;
}

export const FormatPills: React.FC<FormatPillsProps> = ({
  outputs,
  selectedFormat,
  onSelectFormat,
  className,
  label = 'Convert to',
}) => {
  if (outputs.length <= 1) return null;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-card border border-border bg-card p-3 sm:px-4 sm:py-3',
        className
      )}
    >
      <div className="text-xs font-medium text-foreground">{label}</div>

      <div className="flex flex-wrap items-center gap-1.5">
        {outputs.map((out) => {
          const isSelected = selectedFormat === out.value;
          return (
            <button
              key={out.value}
              type="button"
              onClick={() => onSelectFormat(out.value)}
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-chip px-3 text-xs font-mono font-medium uppercase transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {out.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
