import * as React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { AppError, errorToView } from '@/features/server/errorToView';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorAlertProps {
  error: AppError | Error | string;
  onAction?: (actionKind?: string) => void;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  onAction,
  className,
}) => {
  const view = errorToView(error);
  const isWarning = view.severity === 'warning';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-card border p-4 transition-colors',
        isWarning
          ? 'border-warning/30 bg-warning/5 text-foreground'
          : 'border-destructive/30 bg-destructive/5 text-foreground',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-btn',
            isWarning ? 'text-warning bg-warning/10' : 'text-destructive bg-destructive/10'
          )}
        >
          {isWarning ? (
            <AlertTriangle className="h-4 w-4 stroke-[1.75]" />
          ) : (
            <AlertCircle className="h-4 w-4 stroke-[1.75]" />
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold">{view.title}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{view.message}</p>
        </div>
      </div>

      {view.actionLabel && (
        <div className="self-end sm:self-center shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAction?.(view.actionKind)}
            className="text-xs"
          >
            {view.actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
