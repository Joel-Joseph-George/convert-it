import * as React from 'react';
import { Download, Trash2 } from 'lucide-react';
import { QueueItem } from '@/features/queue/queueStore';
import { FileRow } from './FileRow';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FileQueueProps {
  items: QueueItem[];
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onRetryItem?: (id: string) => void;
  onDownloadAllZip?: () => void;
  className?: string;
}

export const FileQueue: React.FC<FileQueueProps> = ({
  items,
  onRemoveItem,
  onClearQueue,
  onRetryItem,
  onDownloadAllZip,
  className,
}) => {
  const completedCount = items.filter((i) => i.status === 'done').length;

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-between rounded-card border border-border bg-card px-4 py-3 text-xs text-muted-foreground',
          className
        )}
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          No files in queue
        </span>
        <span>Batch mode supported</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card overflow-hidden',
        className
      )}
    >
      {/* Queue Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <span>Files to convert</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {items.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {completedCount > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownloadAllZip}
              className="h-7 text-xs gap-1.5 text-primary"
            >
              <Download className="h-3 w-3 stroke-[2]" />
              <span>Download all (ZIP)</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearQueue}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear all</span>
          </Button>
        </div>
      </div>

      {/* Queue Items */}
      <div className="divide-y divide-border">
        {items.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            onRemove={onRemoveItem}
            onRetry={onRetryItem}
          />
        ))}
      </div>
    </div>
  );
};
