import * as React from 'react';
import { QueueItemStatus } from '@/features/queue/queueStore';
import { cn } from '@/lib/utils';

export interface StatusPillProps {
  status: QueueItemStatus;
  progress?: number;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  progress,
  className,
}) => {
  let dotColor = 'bg-muted-foreground';
  let label = 'Ready';

  switch (status) {
    case 'ready':
      dotColor = 'bg-muted-foreground';
      label = 'Ready';
      break;
    case 'converting':
      dotColor = 'bg-warning animate-pulse';
      label = progress !== undefined ? `${progress}%` : 'Converting';
      break;
    case 'done':
      dotColor = 'bg-success';
      label = 'Done';
      break;
    case 'failed':
      dotColor = 'bg-destructive';
      label = 'Failed';
      break;
    case 'cancelled':
      dotColor = 'bg-muted-foreground';
      label = 'Cancelled';
      break;
  }

  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-full bg-muted px-2 text-[11px] font-medium text-foreground',
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
      <span>{label}</span>
    </span>
  );
};
