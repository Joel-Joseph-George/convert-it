import * as React from 'react';
import {
  FileText,
  Music,
  Video,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  X,
  Download,
  RotateCw,
} from 'lucide-react';
import { QueueItem } from '@/features/queue/queueStore';
import { StatusPill } from '@/components/shared/StatusPill';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FileRowProps {
  item: QueueItem;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(filename: string): React.ComponentType<{ className?: string }> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) return Music;
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return Video;
  if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'svg', 'heic'].includes(ext)) return ImageIcon;
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) return FileSpreadsheet;
  if (['zip', 'tar', 'gz', '7z'].includes(ext)) return FileArchive;
  if (['json', 'md', 'html', 'txt'].includes(ext)) return FileCode;
  if (['pdf', 'docx', 'doc'].includes(ext)) return FileText;
  return File;
}

export const FileRow: React.FC<FileRowProps> = ({
  item,
  onRemove,
  onRetry,
  className,
}) => {
  const Icon = getFileIcon(item.file.name);

  const handleDownload = (): void => {
    if (item.result?.url) {
      const a = document.createElement('a');
      a.href = item.result.url;
      a.download = item.result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div
      className={cn(
        'group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/40',
        className
      )}
    >
      {/* File Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-muted text-muted-foreground">
          <Icon className="h-4 w-4 stroke-[1.75]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground truncate">
            {item.file.name}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground mt-0.5">
            <span>{formatBytes(item.file.size)}</span>
            <span>•</span>
            <span className="uppercase text-primary font-medium">
              → {item.targetFormat}
            </span>
            {item.result && (
              <>
                <span>•</span>
                <span className="text-success">
                  {formatBytes(item.result.sizeBytes)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress / Status / Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        {item.status === 'converting' && (
          <div className="flex items-center gap-3 w-36 sm:w-44">
            <ProgressBar progress={item.progress} className="flex-1" />
            <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">
              {item.progress}%
            </span>
          </div>
        )}

        <StatusPill status={item.status} progress={item.progress} />

        {item.status === 'done' && item.result && (
          <Button
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5 stroke-[1.75]" />
            <span>Download</span>
          </Button>
        )}

        {item.status === 'failed' && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetry(item.id)}
            className="h-7 px-2 text-xs gap-1"
          >
            <RotateCw className="h-3 w-3" />
            <span>Retry</span>
          </Button>
        )}

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label="Remove file"
          className="rounded-btn p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4 stroke-[1.75]" />
        </button>
      </div>
    </div>
  );
};
