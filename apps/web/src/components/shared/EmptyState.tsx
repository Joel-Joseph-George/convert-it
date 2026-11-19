import * as React from 'react';
import { LucideIcon, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Search,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-border bg-card p-8 text-center sm:p-12',
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-btn bg-muted text-muted-foreground">
        <Icon className="h-5 w-5 stroke-[1.75]" />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
        {description}
      </p>

      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onAction} className="text-xs">
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
